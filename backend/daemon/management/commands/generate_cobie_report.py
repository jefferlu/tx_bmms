# your_project/management/commands/generate_cobie_report.py
import os
import pandas as pd
from django.core.management.base import BaseCommand
from django.db.models import Q, Exists, OuterRef, Case, When, Value, CharField
from apps.forge.models import (
    BimCobie, BimObject, BimModel,
    BimRegion, ZoneCode, RoleCode, FileTypeCode, LevelCode
)
from openpyxl.styles import Font
from datetime import datetime


def parse_filename(value):
    if not value:
        return None
    filename = value.split('/')[-1].rsplit('.', 1)[0]
    parts = filename.split('-')
    if len(parts) != 9:
        return None
    return {
        'Project': parts[0], 'Tender': parts[1], 'Zone': parts[2],
        'Level': parts[3], 'Location': parts[4], 'Type': parts[5],
        'Role': parts[6], 'Number': parts[7], 'Revision': parts[8],
    }


class Command(BaseCommand):
    help = (
        "產生 COBie + 檔案命名規範整合報表\n\n"
        "使用方式：\n"
        "  只產生全專案總表\n"
        "    python manage.py generate_cobie_report\n\n"
        "  同時產生總表 + 每個模型獨立報表（推薦！）\n"
        "    python manage.py generate_cobie_report --per-model\n\n"
        "報表將輸出至：delivery_reports/YYYYMMDD_HHMM/ 資料夾\n"
        "檔名規則：\n"
        "  全專案總表 → cobie_compliance_report.xlsx\n"
        "  各模型報表 → 直接使用模型名稱.xlsx（如：T3-TP16-A06-AR.xlsx）"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--per-model',
            action='store_true',
            help='為每個模型產生獨立報表（同時保留全專案總表）'
        )

    def handle(self, *args, **options):
        # 建立帶時間戳記的資料夾
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        output_dir = os.path.join(os.getcwd(), "delivery_reports", timestamp)
        os.makedirs(output_dir, exist_ok=True)

        self.stdout.write(f"報表輸出目錄：{output_dir}")

        # 主檔代碼
        valid_zones = set(ZoneCode.objects.filter(is_active=True).values_list('code', flat=True))
        valid_levels = set(LevelCode.objects.filter(is_active=True).values_list('code', flat=True))
        valid_types = set(FileTypeCode.objects.filter(is_active=True).values_list('code', flat=True))
        valid_roles = set(RoleCode.objects.filter(is_active=True).values_list('code', flat=True))

        all_active_cobie = BimCobie.objects.filter(is_active=True).order_by('name')
        all_models = BimModel.objects.prefetch_related('bim_objects', 'bim_regions').all()

        # ==================== 1. 產生全專案總表 ====================
        total_report_data, total_error_details, total_naming_summary, total_naming_details = self.generate_full_report(
            all_active_cobie=all_active_cobie,
            regions_qs=BimRegion.objects.select_related('bim_model').all(),
            valid_zones=valid_zones, valid_levels=valid_levels,
            valid_types=valid_types, valid_roles=valid_roles
        )

        total_file = os.path.join(output_dir, "cobie_compliance_report.xlsx")
        self.write_excel(total_file, total_report_data, total_error_details, total_naming_summary, total_naming_details)
        self.stdout.write(self.style.SUCCESS(f"全專案總表產生完成：{total_file}"))

        # ==================== 2. 若有 --per-model，產生各模型報表 ====================
        if options['per_model']:
            self.stdout.write("開始產生各模型獨立報表...")

            for model in all_models:
                model_name = model.name.strip()
                # 清理檔名（避免非法字元）
                safe_filename = "".join(c for c in model_name if c.isalnum() or c in ('-', '_', ' ')).rstrip()
                if not safe_filename:
                    safe_filename = f"模型_{model.id}"

                model_report_data, model_error_details, model_naming_summary, model_naming_details = self.generate_model_report(
                    model=model,
                    all_active_cobie=all_active_cobie,
                    valid_zones=valid_zones, valid_levels=valid_levels,
                    valid_types=valid_types, valid_roles=valid_roles
                )

                model_file = os.path.join(output_dir, f"{safe_filename}.xlsx")
                self.write_excel(model_file, model_report_data, model_error_details, model_naming_summary, model_naming_details)
                self.stdout.write(f"  {model_name} → {safe_filename}.xlsx")

            self.stdout.write(self.style.SUCCESS(f"所有模型報表產生完成！共 {all_models.count()} 個"))

        else:
            self.stdout.write("未使用 --per-model，僅產生全專案總表")

    # —————————————————————— 報表產生邏輯 ——————————————————————
    def generate_full_report(self, all_active_cobie, regions_qs, valid_zones, valid_levels, valid_types, valid_roles):
        return self._generate_report(
            cobie_qs=all_active_cobie,
            objects_qs=BimObject.objects,
            regions_qs=regions_qs,
            valid_zones=valid_zones, valid_levels=valid_levels,
            valid_types=valid_types, valid_roles=valid_roles
        )

    def generate_model_report(self, model, all_active_cobie, valid_zones, valid_levels, valid_types, valid_roles):
        return self._generate_report(
            cobie_qs=all_active_cobie,
            objects_qs=model.bim_objects,
            regions_qs=model.bim_regions,
            model_name=model.name,
            valid_zones=valid_zones, valid_levels=valid_levels,
            valid_types=valid_types, valid_roles=valid_roles
        )

    def _generate_report(self, cobie_qs, objects_qs, regions_qs, model_name=None,
                         valid_zones=None, valid_levels=None, valid_types=None, valid_roles=None):
        report_data = []
        error_details = []
        naming_summary = {k: {'total': 0, 'error': 0} for k in ['區域代碼', '樓層代碼', '檔案類型', '專業角色', '檔名格式']}
        naming_details = []

        # COBie 部分
        for cobie in cobie_qs:
            parts = cobie.name.split('.')
            if len(parts) != 3 or parts[0] != 'COBie':
                continue
            objects = objects_qs.filter(display_name=cobie.name)
            total = objects.count()
            filled = objects.exclude(Q(value__isnull=True) | Q(value='') | Q(value__regex=r'^\s*$')).count()
            empty = total - filled

            report_data.append({
                '資料表類型': parts[1],
                'COBie欄位(英文)': parts[2],
                'COBie欄位(中文)': cobie.description,
                '填寫狀態': cobie.get_status_display(),
                '範例': cobie.example or '',
                '備註': (cobie.note or '').replace('\n', ' ').strip(),
                '有值筆數': filled,
                '無值筆數': empty,
            })

            if cobie.status == 'required' and empty > 0:
                error_objs = objects.filter(Q(value__isnull=True) | Q(value='') | Q(value__regex=r'^\s*$'))
                base_field = f"COBie.{parts[1]}.Name"
                name_subq = BimObject.objects.filter(bim_model=OuterRef('bim_model') if model_name is None else model_name,
                                                   dbid=OuterRef('dbid'), display_name=base_field)
                error_objs = error_objs.annotate(
                    component_name=Case(When(Exists(name_subq), then=name_subq.values('value')[:1]), default=Value('未知元件'), output_field=CharField())
                )
                for obj in error_objs:
                    error_details.append({
                        '模型名稱': model_name or obj.bim_model.name,
                        '元件名稱': obj.component_name,
                        '缺失欄位': cobie.description,
                        'COBie欄位': cobie.name,
                        'dbid': obj.dbid,
                    })

        # 命名規範部分
        for region in regions_qs.select_related('bim_model') if model_name is None else regions_qs.all():
            file_name = region.value.split('/')[-1].rsplit('.', 1)[0]
            parts = file_name.split('-')
            total_parts = len(parts)
            cur_model_name = model_name or region.bim_model.name

            naming_summary['檔名格式']['total'] += 1
            if total_parts != 9:
                naming_summary['檔名格式']['error'] += 1
                naming_details.append({
                    '模型名稱': cur_model_name,
                    '檔案名稱': file_name,
                    '錯誤欄位': '檔名格式',
                    '實際值': f'{total_parts}段',
                    '錯誤原因': '應為9段'
                })
                continue

            parsed = {'Zone': parts[2], 'Level': parts[3], 'Type': parts[5], 'Role': parts[6]}
            for key, val in parsed.items():
                field_map = {'Zone': '區域代碼', 'Level': '樓層代碼', 'Type': '檔案類型', 'Role': '專業角色'}
                valid_map = {'Zone': valid_zones, 'Level': valid_levels, 'Type': valid_types, 'Role': valid_roles}
                field = field_map[key]
                naming_summary[field]['total'] += 1
                if val not in valid_map[key]:
                    naming_summary[field]['error'] += 1
                    naming_details.append({
                        '模型名稱': cur_model_name,
                        '檔案名稱': file_name,
                        '錯誤欄位': field,
                        '實際值': val,
                        '錯誤原因': '未定義'
                    })

        naming_summary_data = []
        for field, stats in naming_summary.items():
            total = stats['total']
            error = stats['error']
            rate = f"{(total - error)/total*100:.1f}%" if total else "--"
            naming_summary_data.append({
                '欄位名稱': field, '總筆數': total, '錯誤筆數': error, '符合率': rate
            })

        return report_data, error_details, naming_summary_data, naming_details

    def write_excel(self, filepath, cobie_data, cobie_details, naming_summary, naming_details):
        font_normal = Font(name='微軟正黑體', size=11)
        font_bold = Font(name='微軟正黑體', size=11, bold=True)

        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            pd.DataFrame(cobie_data).to_excel(writer, sheet_name='COBie總表', index=False,
                columns=['資料表類型','COBie欄位(英文)','COBie欄位(中文)','填寫狀態','範例','備註','有值筆數','無值筆數'])
            pd.DataFrame(cobie_details or [{'訊息': '無必填欄位缺失'}]).to_excel(writer, sheet_name='COBie明細', index=False)
            pd.DataFrame(naming_summary).to_excel(writer, sheet_name='命名規範總表', index=False)
            pd.DataFrame(naming_details or [{'訊息': '無錯誤資料'}]).to_excel(writer, sheet_name='命名錯誤明細', index=False)

            for ws in writer.book.worksheets:
                # 表頭加粗
                for cell in ws[1]:
                    cell.font = font_bold
                # 內容正黑體
                for row in ws.iter_rows(min_row=2):
                    for cell in row:
                        cell.font = font_normal