# BMMS Angular + Django + ELFinder  Stack on Docker

Run the latest version of the [BMMS stack][tx_bmms] with Docker and Docker Compose.

It gives you the ability to import any 3D model by using APS platorm service of Autodesk  and
the micro service ablility via Django backend.

Based on the [official Docker images][elastic-docker] from Elastic:

Other available stack variants:

---

## tl;dr

* 1. 安裝依賴更新，並重建構服務 
```sh 
docker compose build
```

*   or 強制安裝依賴更新
```sh 
docker compose build --no-cache
```

* 2. 啟動/停止服務 
```sh
docker compose up
```

```sh
docker compose down
```

* 3. 啟動/停止單個服務 
```sh
docker compose up <服務名稱>
```

```sh
docker compose stop <服務名稱>
```

---

## Philosophy

We aim at providing the simplest possible entry into the 3D Model Management for anybody who feels like experimenting with
this powerful combo of technologies. This project's default configuration is purposely minimal and unopinionated. It
does not rely on any external dependency, and uses as little custom automation as necessary to get things up and
running.

---

### Host setup

* [Docker Engine][docker-install] version **18.06.0** or newer
* [Docker Compose][compose-install] version **2.0.0** or newer
* 1.5 GB of RAM

> [!NOTE]
> Especially on Linux, make sure your user has the [required permissions][linux-postinstall] to interact with the Docker
> daemon.

By default, the stack exposes the following ports:

* 4000:80: Front-End Client  http://localhost:4000/
* 8100:80: Backend http://localhost:8100/
* 6379:6379: Redis 
* 5433:5432: PostgreSQL DB
* internal_network: ELFinder

### Docker Desktop

#### Windows

If you are using the legacy Hyper-V mode of _Docker Desktop for Windows_, ensure [File Sharing][win-filesharing] is
enabled for the `C:` drive.

#### macOS

The default configuration of _Docker Desktop for Mac_ allows mounting files from `/Users/`, `/Volume/`, `/private/`,
`/tmp` and `/var/folders` exclusively. Make sure the repository is cloned in one of those locations or follow the
instructions from the [documentation][mac-filesharing] to add more locations.

## Usage

> [!WARNING]
> You must rebuild the stack images with `docker compose build` whenever you switch branch or update the
> [version](#version-selection) of an already existing stack.

### Bringing up the stack

Clone this repository onto the Docker host that will run the stack with the command below:

```sh
git clone https://gitlab.com/giantcld/tx_bmms.git
```

Then, initialize the Elasticsearch users and groups required by docker-elk by executing the command:

```sh
docker compose up setup
```

If everything went well and the setup completed without error, start the other stack components:

```sh
docker compose up
```