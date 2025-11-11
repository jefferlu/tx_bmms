import os
import pandas as pd
from django.core.management.base import BaseCommand
from django.db.models import Q, Exists, OuterRef, Case, When, Value, CharField
from apps.forge.models import (
    BimCobie, BimObject, BimModel,
    BimRegion, ZoneCode, RoleCode, FileTypeCode, LevelCode
)
from openpyxl.styles import Font


def parse_filename(value):
    """從 BimRegion.value 解析出 9 個欄位"""
    if not value:
        return {}
    # 取最後一個檔案名
    filename = value.split('/')[-1].rsplit('.', 1)[0]
    parts = filename.split('-')
    if len(parts) < 9:
        return {}
    return {
        'Project': parts[0],
        'Tender': parts[1],
        'Zone': parts[2],
        'Level': parts[3],
        'Location': parts[4],
        'Type': parts[5],
        'Role': parts[6],
        'Number': parts[7],
        'Revision': parts[8],
    }


class Command(BaseCommand):
    help = '產生 COBie + 檔案命名規範 整合報表'

    def handle(self, *args, **options):
        # ==================== 1. COBie 稽核（完全不變） ====================
        required_cobie = BimCobie.objects.filter(
            required_status=True, is_active=True
        ).order_by('name')

        report_data = []
        error_details = []

        for cobie in required_cobie:
            parts = cobie.name.split('.')
            if len(parts) != 3 or parts[0] != 'COBie':
                continue
            table_type, field_en = parts[1], parts[2]

            objects = BimObject.objects.filter(display_name=cobie.name)
            total = objects.count()
            filled = objects.exclude(
                Q(value__isnull=True) |
                Q(value='') |
                Q(value__regex=r'^\s*$')
            ).count()
            error_count = total - filled

            report_data.append({
                '資料表類型': table_type,
                'COBie欄位(英文)': field_en,
                'COBie欄位(中文)': cobie.description,
                '必填狀態': '必填',
                '範例': cobie.example or '',
                '備註': (cobie.note or '').replace('\n', ' ').strip(),
                '符合條件筆數': filled,
                '資料內容錯誤筆數': error_count,
                '總筆數': total,
            })

            if error_count > 0:
                error_objs = objects.filter(
                    Q(value__isnull=True) |
                    Q(value='') |
                    Q(value__regex=r'^\s*$')
                ).select_related('bim_model')

                base_field = f"COBie.{table_type}.Name"
                name_subq = BimObject.objects.filter(
                    bim_model=OuterRef('bim_model'),
                    dbid=OuterRef('dbid'),
                    display_name=base_field
                )

                error_objs = error_objs.annotate(
                    component_name=Case(
                        When(Exists(name_subq), then=name_subq.values('value')[:1]),
                        default=Value('未知元件'),
                        output_field=CharField()
                    )
                )

                for obj in error_objs:
                    error_details.append({
                        '模型名稱': obj.bim_model.name,
                        '元件名稱': obj.component_name,
                        '缺失欄位': cobie.description,
                        'COBie欄位': cobie.name,
                        'dbid': obj.dbid,
                    })

        # ==================== 2. 檔案命名規範稽核（從 value 解析） ====================
        naming_summary = {}
        naming_details = []

        # 主檔（只取 is_active=True）
        valid_zones = set(ZoneCode.objects.filter(is_active=True).values_list('code', flat=True))
        valid_levels = set(LevelCode.objects.filter(is_active=True).values_list('code', flat=True))
        valid_types = set(FileTypeCode.objects.filter(is_active=True).values_list('code', flat=True))
        valid_roles = set(RoleCode.objects.filter(is_active=True).values_list('code', flat=True))

        regions = BimRegion.objects.select_related('bim_model').all()

        for region in regions:
            parsed = parse_filename(region.value)
            if not parsed:
                continue

            file_name = region.value.split('/')[-1].rsplit('.', 1)[0]

            # 檢查 Zone
            zone_val = parsed.get('Zone')
            if zone_val:
                naming_summary.setdefault('區域代碼', {'total': 0, 'error': 0})
                naming_summary['區域代碼']['total'] += 1
                if zone_val not in valid_zones:
                    naming_summary['區域代碼']['error'] += 1
                    naming_details.append({
                        '模型名稱': region.bim_model.name,
                        '檔案名稱': file_name,
                        '錯誤欄位': '區域代碼',
                        '實際值': zone_val,
                        '錯誤原因': '主檔未定義'
                    })

            # 檢查 Level
            level_val = parsed.get('Level')
            if level_val:
                naming_summary.setdefault('樓層代碼', {'total': 0, 'error': 0})
                naming_summary['樓層代碼']['total'] += 1
                if level_val not in valid_levels:
                    naming_summary['樓層代碼']['error'] += 1
                    naming_details.append({
                        '模型名稱': region.bim_model.name,
                        '檔案名稱': file_name,
                        '錯誤欄位': '樓層代碼',
                        '實際值': level_val,
                        '錯誤原因': '主檔未定義'
                    })

            # 檢查 FileType
            type_val = parsed.get('Type')
            if type_val:
                naming_summary.setdefault('檔案類型', {'total': 0, 'error': 0})
                naming_summary['檔案類型']['total'] += 1
                if type_val not in valid_types:
                    naming_summary['檔案類型']['error'] += 1
                    naming_details.append({
                        '模型名稱': region.bim_model.name,
                        '檔案名稱': file_name,
                        '錯誤欄位': '檔案類型',
                        '實際值': type_val,
                        '錯誤原因': '主檔未定義'
                    })

            # 檢查 Role
            role_val = parsed.get('Role')
            if role_val:
                naming_summary.setdefault('專業角色', {'total': 0, 'error': 0})
                naming_summary['專業角色']['total'] += 1
                if role_val not in valid_roles:
                    naming_summary['專業角色']['error'] += 1
                    naming_details.append({
                        '模型名稱': region.bim_model.name,
                        '檔案名稱': file_name,
                        '錯誤欄位': '專業角色',
                        '實際值': role_val,
                        '錯誤原因': '主檔未定義'
                    })

        # 整理總表
        naming_summary_data = []
        for field, stats in naming_summary.items():
            total = stats['total']
            error = stats['error']
            rate = f"{(total - error)/total*100:.1f}%" if total else "N/A"
            naming_summary_data.append({
                '欄位名稱': field,
                '總筆數': total,
                '錯誤筆數': error,
                '符合率': rate
            })

        # ==================== 3. 輸出 Excel ====================
        excel_file = 'cobie_compliance_report.xlsx'
        excel_path = os.path.join(os.getcwd(), excel_file)

        jhenghei_font = Font(name='微軟正黑體', size=11, bold=False)
        bold_font = Font(name='微軟正黑體', size=11, bold=True)

        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            pd.DataFrame(naming_summary_data).to_excel(writer, sheet_name='命名規範總表', index=False)
            pd.DataFrame(naming_details or [{'訊息': '無錯誤資料'}]).to_excel(writer, sheet_name='命名錯誤明細', index=False)
            pd.DataFrame(report_data).to_excel(writer, sheet_name='COBie規範總表', index=False)
            pd.DataFrame(error_details or [{'訊息': '無錯誤資料'}]).to_excel(writer, sheet_name='COBie錯誤明細', index=False)
            

            for sheet_name in writer.book.sheetnames:
                ws = writer.book[sheet_name]
                for row in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=1, max_col=ws.max_column):
                    for cell in row:
                        cell.font = jhenghei_font if cell.row > 1 else bold_font

        self.stdout.write(self.style.SUCCESS(f"整合報表產生：{excel_path}"))
        self.stdout.write(f"COBie: {len(report_data)} 欄位，{len(error_details)} 筆錯誤")
        self.stdout.write(f"命名規範: {len(naming_details)} 筆錯誤")
