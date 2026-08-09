import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const __dirname = path.resolve();

/* ── Utility: Escape LaTeX special characters (text only, NOT urls) ── */

function escapeLatex(text = "") {
  if (typeof text !== "string") return "";

  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

/* ── Safe array normalizer ── */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

/* ── Convert array to LaTeX bullet items ── */

function generateItemizeSection(items = []) {
  return safeArray(items)
    .map((item) => `\\item ${escapeLatex(item)}`)
    .join("\n");
}

/* ── Convert projects array to LaTeX items with bold titles ── */

function generateProjectsSection(projects = []) {
  return safeArray(projects)
    .map((proj) => {
      if (typeof proj === "string") {
        return `\\item ${escapeLatex(proj)}`;
      }

      let line = "\\item";

      if (proj.title) {
        line += ` \\textbf{${escapeLatex(proj.title)}}`;
      }

      if (proj.techStack) {
        line += ` \\hfill \\textit{(${escapeLatex(proj.techStack)})}`;
      }

      if (proj.description) {
        line += `\n\\newline ${escapeLatex(proj.description)}`;
      }

      return line;
    })
    .join("\n\\vspace{2mm}\n");
}

/* ── Convert education array to table rows ── */

function generateEducationRows(education = []) {
  return safeArray(education)
    .map(
      (ed) =>
        `${escapeLatex(ed.year || "")} & ${escapeLatex(
          ed.degree || ""
        )} & ${escapeLatex(ed.score || "")} \\\\ \\hline`
    )
    .join("\n");
}

/* ── Build LaTeX Command ── */

function getLatexCommand(outputDir, texFilePath) {
  // Linux / Docker / Render
  if (os.platform() !== "win32") {
    return `latexmk -pdf -interaction=nonstopmode -output-directory="${outputDir}" "${texFilePath}"`;
  }

  // Windows (Local Development)
  const pdflatex =
    '"C:\\Users\\sabaa\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe"';

  return `${pdflatex} -interaction=nonstopmode -output-directory="${outputDir}" "${texFilePath}"`;
}

/* ── Compile .tex to PDF ── */

function compilePdf(outputDir, texFilePath, pdfPath) {
  const cmd = getLatexCommand(outputDir, texFilePath);

  console.log("Executing:", cmd);

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      console.log("Error:", error);
      console.log("STDOUT:\n", stdout);
      console.log("STDERR:\n", stderr);

      if (fs.existsSync(pdfPath)) {
        return resolve(pdfPath);
      }

      reject(
        new Error(
          stderr || stdout || (error ? error.message : "PDF generation failed")
        )
      );
    });
  });
}