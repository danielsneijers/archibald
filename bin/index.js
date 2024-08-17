#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import puppeteer from "puppeteer";
import path from "path";

program
  .version("1.0.0")
  .description("Archibald - archive the web")
  .argument("<url>", "url of webpage to archive")
  .option("-n, --name <type>", "Add your name")
  .action(archive);

program.parse(process.argv);

async function archive(url, options) {
  console.log(options);
  const spinner = ora(`Doing something...`).start();

  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Navigate the page to a URL.
  await page.goto(url);

  // Set screen size.
  await page.setViewport({ width: 1080, height: 1024 });

  // const screenshotName = `screenshot-${Date.now().toString()}.png`;
  // const screenshotPath = path.resolve(`screenshots/${screenshotName}`);
  // const element = await page.$("html");

  // if (element) {
  //   await element.screenshot({ path: screenshotPath });
  //   console.log("Successfully made screenshot: ", screenshotPath);
  // } else {
  //   throw new Error("Couldn't screenshot bro");
  // }

  // const pdf = await page.pdf({
  //   format: "A4",
  //   path: `screenshots/screenshot-${Date.now().toString()}.pdf`,
  //   printBackground: true,
  // });

  await browser.close();

  spinner.succeed(chalk.green("Done!"));
  return 0;
}
