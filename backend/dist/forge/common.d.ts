import { IAuthOptions } from "forge-server-utils/dist/common";
import { IEnvironment } from "./environment";
import { AuthenticationClient, BIM360Client, DataManagementClient, ModelDerivativeClient, WebhooksClient } from "forge-server-utils";
export interface IPreviewSettings {
    extensions: string[];
    env?: string;
    api?: string;
}
export interface IContext {
    credentials: IAuthOptions;
    environment: IEnvironment;
    authenticationClient: AuthenticationClient;
    dataManagementClient: DataManagementClient;
    modelDerivativeClient2L: ModelDerivativeClient;
    modelDerivativeClient3L: ModelDerivativeClient;
    webhookClient: WebhooksClient;
    bim360Client: BIM360Client;
    threeLeggedToken?: string;
}
