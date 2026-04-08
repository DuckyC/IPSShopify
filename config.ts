import config from "./config.default.json";
import defaultConfigContent from "./config.default.json" with { type: "text" };
import { file, write} from "bun"

export async function initConfig(): Promise<void> {
    const configFile = file("config.json");
    if(!await configFile.exists()) {
        write(configFile, JSON.stringify(defaultConfigContent, null, 2));
        throw new Error("Config file not found. Created default config file. Please edit the config file and restart the application.");
    }
    
    const customConfig = await configFile.json()
    Object.assign(config, customConfig);
}

export default config;