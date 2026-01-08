"""
建立 File Manager 權限
"""
from django.db import migrations


def create_permissions(apps, schema_editor):
    """建立自定義權限"""
    ContentType = apps.get_model('contenttypes', 'ContentType')
    Permission = apps.get_model('auth', 'Permission')

    # 建立一個內容類型用於權限
    content_type, created = ContentType.objects.get_or_create(
        app_label='file_manager',
        model='filemanager',
    )

    # 建立檢視權限
    Permission.objects.get_or_create(
        codename='view_files',
        name='Can view files',
        content_type=content_type,
    )

    # 建立編輯權限
    Permission.objects.get_or_create(
        codename='edit_files',
        name='Can edit files',
        content_type=content_type,
    )


def delete_permissions(apps, schema_editor):
    """刪除自定義權限"""
    Permission = apps.get_model('auth', 'Permission')
    Permission.objects.filter(
        codename__in=['view_files', 'edit_files'],
        content_type__app_label='file_manager',
    ).delete()


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('contenttypes', '__latest__'),
        ('auth', '__latest__'),
    ]

    operations = [
        migrations.RunPython(create_permissions, delete_permissions),
    ]
