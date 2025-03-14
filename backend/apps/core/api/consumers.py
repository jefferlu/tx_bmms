import json
from channels.generic.websocket import AsyncWebsocketConsumer


class DatabaseConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'database_group'
        print('Trying to connect and join group...')
        # Join the WebSocket group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        print(f'Connected to group {self.group_name}')
        await self.accept()

    async def disconnect(self, close_code):
        # Leave the WebSocket group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive message from group(code)
    async def database_message(self, event):
        print('database_message:', event)
        await self.send(text_data=json.dumps(event))
