"""
Copyright (C) 2024  chuongmep.com

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
"""
import os
from pathlib import Path
import requests
from .Auth import Auth
import pandas as pd
import sqlite3
from .Token import Token


class DbReader:
    def __init__(self, urn: str, token: Token = None, objectKey: str = '', send_progress=None, region: str = "US"):
        self.urn = urn
        self.objectKey = objectKey
        self.send_progress = send_progress
        self.region = region
        if token is None:
            auth = Auth()
            self.token = auth.auth2leg()
        else:
            self.token = token

        # 設置主機，根據地區選擇適當的端點
        self.host = "https://developer.api.autodesk.com"
        if self.region == "EMEA":
            self.host = "https://developer.api.autodesk.com/modelderivative/v2/regions/eu"
        elif self.region == "AUS":
            self.host = "https://developer.api.autodesk.com/modelderivative/v2/regions/aus"

        # 獲取 manifest
        url = f"{self.host}/modelderivative/v2/designdata/{self.urn}/manifest"
        headers = {
            "Authorization": f"Bearer {self.token.access_token}"
        }
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise Exception(f"無法獲取 manifest: {response.status_code} - {response.content.decode()}")
        json_response = response.json()
        if json_response["status"] != "success":
            raise Exception(json_response)

        # 尋找 SQLite 資料庫的 derivativeUrn
        childrens = json_response['derivatives'][0]["children"]
        self.path = ""
        for child in childrens:
            if child["type"] == "resource" and child["mime"] == "application/autodesk-db":
                self.path = child["urn"]
                break
        if not self.path:
            raise Exception("未找到 SQLite 資料庫的 derivativeUrn")

        # 設置儲存路徑
        temp_path = os.path.join(Path(__file__).parent.parent.parent.parent, "media-root/sqlite")
        extension = "db"  # 固定使用 .db 副檔名
        file_name = self.urn if objectKey == '' else objectKey
        temp_path = os.path.join(temp_path, f"{file_name}.{extension}")
        self.db_path = temp_path

        if not os.path.exists(temp_path):
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)

        # 下載 SQLite 資料庫
        self.download_derivative(self.urn, self.path, headers, temp_path)

    def download_derivative(self, urn, derivative_urn, headers, output_path, chunk_size=5 * 1024 * 1024):
        # 步驟 1: 使用 Fetch Derivative Download URL 獲取下載 URL 和簽名 Cookie
        self.send_progress("start", "Starting SQLite database download")
        signed_url_endpoint = f"{self.host}/modelderivative/v2/designdata/{urn}/manifest/{derivative_urn}/signedcookies"
        response = requests.get(signed_url_endpoint, headers=headers)
        if response.status_code != 200:
            self.send_progress("error", f"Failed to fetch SQLite download URL: {response.status_code} - {response.content.decode()}")
            raise Exception(f"Failed to fetch SQLite download URL: {response.status_code} - {response.content.decode()}")

        signed_url_data = response.json()
        download_url = signed_url_data.get("url")
        if not download_url:
            self.send_progress("error", "Download SQLite URL not found")
            raise Exception("Download SQLite URL not found")

        # 從標頭中提取 Cookie
        cookies = {}
        set_cookie_headers = response.headers.get("Set-Cookie")
        if set_cookie_headers:
            cookie_list = set_cookie_headers.split(", ")
            for cookie in cookie_list:
                key_value = cookie.split(";")[0].split("=")
                if len(key_value) == 2:
                    cookies[key_value[0]] = key_value[1]

        if not cookies:
            self.send_progress("error", "Signed SQLite cookies not found")
            raise Exception("Signed SQLite cookies not found")

        # 步驟 2: 使用 HEAD 請求獲取檔案大小
        response = requests.head(download_url, cookies=cookies)
        if response.status_code != 200:
            self.send_progress("error", f"Failed to fetch SQLite file info: {response.status_code} - {response.content.decode()}")
            raise Exception(f"Failed to fetch SQLite file info: {response.status_code} - {response.content.decode()}")

        total_size = int(response.headers.get('Content-Length', 0))
        if total_size == 0:
            self.send_progress("error", "Failed to fetch SQLite file size")
            raise Exception("Failed to fetch SQLite file size")

        # 步驟 3: 分塊下載並傳送進度訊息
        downloaded_size = 0
        with open(output_path, "wb") as file:
            for start in range(0, total_size, chunk_size):
                end = min(start + chunk_size - 1, total_size - 1)
                range_header = {"Range": f"bytes={start}-{end}"}

                response = requests.get(download_url, headers=range_header, cookies=cookies, stream=True)
                if response.status_code not in [200, 206]:
                    self.send_progress(
                        "error", f"Chunk download SQLite failed: {response.status_code} - {response.content.decode()}")
                    raise Exception(f"Chunk download SQLite failed: {response.status_code} - {response.content.decode()}")

                file.write(response.content)
                downloaded_size += len(response.content)

                # 傳送 WebSocket 進度訊息
                progress_percent = (downloaded_size / total_size) * 100
                self.send_progress("progress", f"Download SQLite database: {progress_percent:.2f}%")

        self.send_progress("success", f"Download SQLite database completed.")

    def execute_query(self, query: str):
        conn = sqlite3.connect(self.db_path)
        return pd.read_sql_query(query, conn)
