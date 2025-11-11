import csv
import os
import pandas as pd

from django.core.management.base import BaseCommand
from django.db.models import Q, Exists, OuterRef, Case, When, Value, CharField

from openpyxl.styles import Font
from apps.forge.models import BimCobie, BimObject


class Command(BaseCommand):
    help = '產生 COBie 資料符合度 CSV 報表'

    def handle(self, *args, **options):
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

            # --- 總表統計 ---
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

            # --- 明細 ---
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
                        '元件名稱': cobie.name,
                        '缺失欄位': cobie.description,
                        'COBie欄位': cobie.name,
                        'dbid': obj.dbid,
                    })

        # --- 產生 Excel（微軟正黑體）---
        excel_file = 'cobie_compliance_report.xlsx'
        excel_path = os.path.join(os.getcwd(), excel_file)

        # 定義字型
        jhenghei_font = Font(name='微軟正黑體', size=11, bold=False)

        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Sheet 1: 總表
            summary_df = pd.DataFrame(report_data)
            summary_df.to_excel(writer, sheet_name='COBie總表', index=False)

            # Sheet 2: 錯誤明細
            details_df = pd.DataFrame(error_details if error_details else [{'訊息': '無錯誤資料'}])
            details_df.to_excel(writer, sheet_name='COBie明細', index=False)

            # --- 套用字型到所有儲存格 ---
            for sheet_name in writer.book.sheetnames:
                ws = writer.book[sheet_name]

                for row in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=1, max_col=ws.max_column):
                    for cell in row:
                        cell.font = jhenghei_font

                # 標題列加粗
                for cell in ws[1]:
                    cell.font = Font(name='微軟正黑體', size=11, bold=True)

        self.stdout.write(self.style.SUCCESS(f"報表產生成功：{excel_path}"))
        self.stdout.write(f"共 {len(report_data)} 個欄位，{len(error_details)} 筆錯誤明細。")
