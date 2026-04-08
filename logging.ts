import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import config from "./config";

var logger: winston.Logger;

export function getLogger() {
  if (logger) {
    return logger;
  }

  logger = winston.createLogger({
    level: config.log_level,
    defaultMeta: { service: "IPSShopify" },
    transports: [
      new DailyRotateFile({
        level: config.log_level,
        filename: "application-%DATE%.log",
        datePattern: "YYYY-MM-DD-HH",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "7d",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      }),

      new winston.transports.Console({
        level: config.log_level,
        format: winston.format.cli(),
      }),
    ],
  });

  return logger;
}
