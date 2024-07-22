import { IAuthOptions } from "aps-sdk-node/dist/common";
import { IEnvironment } from "./environment";
import { AuthenticationClient, BIM360Client, DataManagementClient, DesignAutomationClient, ModelDerivativeClient, WebhooksClient } from  "aps-sdk-node";

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
    modelDerivativeClient2L: ModelDerivativeClient; // client for 2-legged workflows
    modelDerivativeClient3L: ModelDerivativeClient; // client for 3-legged workflows
    // designAutomationClient: DesignAutomationClient;
    webhookClient: WebhooksClient;
    bim360Client: BIM360Client;
    threeLeggedToken?: string;
}

