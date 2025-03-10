# BMMS System
This project is a full-stack web application using Angular for the frontend and Django for the backend.

## Features

- **[Angular](https://angular.dev/) Frontend**: A powerful and modular frontend framework for building dynamic user interfaces.
- **[Django](https://www.djangoproject.com/) Backend**: Django makes it easier to build better web apps more quickly and with less code.
- **[Django Rest framework](https://www.djangoproject.com/) RESTful API**: A powerful and flexible toolkit for building Web APIs.
- **Authentication**: User authentication using JWT.

## Prerequisites
### Python
Get the latest version of Python at https://www.python.org/downloads/ or with your operating system’s package manager.

You can verify that Python is installed by typing **python** from your shell; you should see something like:
``` sh
Python 3.x.y
[GCC 4.x] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>>
```

### Django
1.  Install [Pipenv](https://pipenv.pypa.io/en/latest/installation.html)

2.  Installing packages for project
    ```sh
    $ cd backend
    $ mkdir .venv
    $ pipenv install
    ```
3.  Make sure you've created and activated a virtual environment, in **backend** folder enter the command:
    ```sh
    $ pipenv shell
    ```

4. Run Django project in development mode. In **backend** folder:
    ```sh
    $ python manage.py runserver
    ```

    You’ll see the following output on the command line:
    ```
    Performing system checks...

    System check identified no issues (0 silenced).
    June 21, 2024 - 23:33:58
    Django version 5.0.6, using settings 'bmms.settings'
    Starting ASGI/Daphne version 4.1.2 development server at http://127.0.0.1:8000/
    Quit the server with CTRL-BREAK.
    ```
    Now that the server’s running, visit http://127.0.0.1:8000/ with your web browser. 

