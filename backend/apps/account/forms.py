
from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from . import models


class CustomUserCreationForm(UserCreationForm):

    class Meta(UserCreationForm):
        model = models.User
        fields = ()


class CustomUserChangeForm(UserChangeForm):

    class Meta:
        model = models.User
        fields = ()


class LoginForm(forms.Form):
    username = forms.CharField(
        widget=forms.TextInput(
            attrs={
                "placeholder": "使用者",
                "class": "form-control"
            }
        ))
    password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={
                "placeholder": "密碼",
                "class": "form-control"
            }
        ))
