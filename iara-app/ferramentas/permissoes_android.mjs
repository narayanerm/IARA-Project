// Põe no AndroidManifest as permissões de localização (para o botão "Usar minha localização").
import { readFileSync, writeFileSync } from "node:fs";
const arq = new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url);
let xml = readFileSync(arq, "utf8");
for (const p of ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]) {
  const linha = `<uses-permission android:name="android.permission.${p}" />`;
  if (!xml.includes(linha)) xml = xml.replace("</manifest>", `    ${linha}\n</manifest>`);
}
writeFileSync(arq, xml);
console.log("Permissões de localização no AndroidManifest.xml");
