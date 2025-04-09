from django.core.management.base import BaseCommand
from apps.forge.models import LevelCode  # 請將 'your_app' 替換為你的應用程式名稱

class Command(BaseCommand):
    help = 'Initialize LevelCode data'

    def handle(self, *args, **options):
        level_codes = [
            ("RF", "Roof"),
            ("4F", "Arrivals"),
            ("3F", "Departures / MFB"),
            ("2F", "Code C contact / MFB Link / Offices / MBE"),
            ("1M", "P4"),
            ("1F", "Apron / Baggage / Reclaim / MBE"),
            ("BM", "Baggage RoW"),
            ("B1", "Parking"),
            ("B2", "MRT ticketing / Parking / BHS"),
            ("B3", "MRT platform / MRT Back of House"),
            ("XX", "Undefined"),
        ]

        self.stdout.write(self.style.NOTICE('Initializing LevelCode...'))
        for code, description in level_codes:
            obj, created = LevelCode.objects.update_or_create(
                code=code,
                defaults={'description': description}
            )
            action = "Inserted" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{action} LevelCode: {code} - {description}"))
        self.stdout.write(self.style.SUCCESS('LevelCode initialization completed!'))