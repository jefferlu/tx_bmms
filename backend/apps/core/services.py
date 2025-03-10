from . import models


def log_user_activity(user, function, action, status, ip_address):
    models.LogUserActivity.objects.create(
        user=user,
        function=function,
        action=action,
        status=status,
        ip_address=ip_address
    )
