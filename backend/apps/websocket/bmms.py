# import json

# from channels.generic.websocket import AsyncWebsocketConsumer
# from asgiref.sync import async_to_sync
# from utils.mqtt import MQTTClient

# class SkyrimGalaxyData(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.type = self.scope["url_route"]["kwargs"]["type"]
#         await self.accept()

#         self.mqtt_client = MQTTClient('Skyrim-Galaxy/Data')
#         self.mqtt_client.start()
#         self.mqtt_client.client.on_message = self.on_mqtt_message

#     def on_mqtt_message(self, client, userdata, message):
#         try:
#             self.client = client

#             payload = message.payload.decode('utf-8')
#             # print('payload', payload, client, userdata)

#             async_to_sync(self.send)(text_data=json.dumps({
#                 'topic': message.topic,
#                 'payload': payload
#             }))

#         except Exception as e:
#             print(f"Error processing message: {e}")

#     async def disconnect(self, close_code):
#         print('disconnect websocket')
#         self.mqtt_client.client.loop_stop()
#         self.mqtt_client.client.disconnect()

#     async def receive(self, text_data):
#         # text_data_json = json.loads(text_data)
#         # message = text_data_json["message"]
#         print(text_data)
#         await self.send(text_data=json.dumps({"message": text_data}))
