#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs-extra";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";

program
  .version("1.0.0")
  .description("Archibald - archive the web")
  .argument("<url>", "URL of the webpage to archive")
  .option("-n, --name <name>", "Add your name or custom identifier")
  .action(archive);

program.parse(process.argv);

async function archive(url, options) {
  const spinner = ora(`Archiving ${url}...`).start();

  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const page = await browser.newPage();

  // Navigate to the provided URL
  await page.goto(url, { waitUntil: "networkidle2" });

  // Extract domain and title
  const domain = getDomainName(url);
  const title = await page.title();
  const sanitizedTitle = sanitizeTitle(title); // Sanitized title
  const folderName = options.name
    ? `${sanitizeTitle(options.name)}`
    : `${domain}_${sanitizedTitle}`;
  const folderPath = path.resolve(`./${folderName}`);
  await fs.ensureDir(folderPath);

  // Scroll to the bottom to load all images
  await autoScroll(page);

  // Save screenshot as PNG
  const screenshotPath = path.join(folderPath, "screenshot.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Save as PDF
  const pdfPath = path.join(folderPath, "page.pdf");
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true });

  // Inline styles, remove scripts, and save HTML
  let htmlContent = await page.content();
  htmlContent = await inlineStyles(page, htmlContent);
  htmlContent = stripScripts(htmlContent);

  const htmlPath = path.join(folderPath, "page.html");
  await fs.writeFile(htmlPath, htmlContent);

  // Extract readable content and save as Markdown
  const markdownContent = await extractMarkdown(page);
  const markdownPath = path.join(folderPath, "page.md");
  await fs.writeFile(markdownPath, markdownContent);

  // Close the browser
  await browser.close();

  spinner.succeed(chalk.green(`Archived successfully in folder: ${folderPath}`));
}

function getDomainName(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "").replace(/[^a-z0-9]/gi, "_");
  } catch (error) {
    console.error("Invalid URL:", url, error);
    return "unknown_domain";
  }
}

function sanitizeTitle(title) {
  return title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

async function inlineStyles(page, htmlContent) {
  const styleUrls = await page.$$eval('link[rel="stylesheet"]', (links) =>
    links.map((link) => link.href)
  );

  let inlinedStyles = "";

  for (const url of styleUrls) {
    try {
      const response = await fetch(url);
      const css = await response.text();
      inlinedStyles += `\n/* Inlined from ${url} */\n${css}\n`;
    } catch (error) {
      console.error(`Failed to fetch stylesheet: ${url}`, error);
    }
  }

  if (inlinedStyles) {
    const styleTag = `<style>${inlinedStyles}</style>`;
    htmlContent = htmlContent.replace("</head>", `${styleTag}</head>`);
  }

  return htmlContent;
}

function stripScripts(htmlContent) {
  return htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

async function extractMarkdown(page) {
  const html = await page.content();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) {
    throw new Error("Failed to extract readable content from the page.");
  }

  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(article.content);

  const title = document.title;
  const markdownWithTitle = "# " + title + "\n\n" + markdown;

  return markdownWithTitle;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
