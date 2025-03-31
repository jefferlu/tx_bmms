import json
from channels.generic.websocket import AsyncWebsocketConsumer


class ProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'progress_group'
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

    # Receive message from WebSocket(Postman)
    async def receive(self, text_data):
        # text_data_json = json.loads(text_data)
        # message = text_data_json['message']

        print('received:', text_data)
        # Send message to room group
        await self.channel_layer.group_send(
            self.group_name, {'type': 'progress.message', 'status': 'upload-object', 'message': text_data}
        )

    # Receive message from group(code)
    async def progress_message(self, event):
        print('progress_message:', event)
        await self.send(text_data=json.dumps(event))


class UpdateCategoryConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'update_category_group'
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
    async def update_category(self, event):
        await self.send(text_data=json.dumps(event))
