from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Initialize database by running all initialization commands'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting database initialization...'))

        # 執行 ZoneCode 初始化
        self.stdout.write(self.style.NOTICE('Running init_zone_codes...'))
        call_command('init_zone_codes')

        # 執行 LevelCode 初始化
        self.stdout.write(self.style.NOTICE('Running init_level_codes...'))
        call_command('init_level_codes')

        self.stdout.write(self.style.SUCCESS('Database initialization completed successfully!'))
