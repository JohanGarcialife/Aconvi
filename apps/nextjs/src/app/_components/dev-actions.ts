"use server";

import fs from "fs";
import path from "path";

export async function getDevMagicLink(email: string) {
  if (process.env.NODE_ENV === "production") return null;
  
  try {
    const filePath = path.join(process.cwd(), ".magic-links.json");
    if (fs.existsSync(filePath)) {
      const links = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return links[email] || null;
    }
  } catch (e) {
    console.error("Error leyendo .magic-links.json", e);
  }
  
  return null;
}
