"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@acme/ui/button";
import { toast } from "@acme/ui/toast";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

export default function CommunityImportPage() {
  const { id: tenantId } = useParams() as { id: string };
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    successCount: number;
    errorCount: number;
    total: number;
  } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) setFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenantId", tenantId);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setResult(data);
      toast.success(`Importación completada: ${data.successCount} vecinos añadidos.`);
    } catch (err: any) {
      toast.error(err.message || "Error al subir el archivo");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Importar Vecinos</h1>
        <p className="text-muted-foreground">
          Sube un archivo de Excel para dar de alta masivamente a los vecinos de esta comunidad.
          El archivo debe contener las columnas: <strong>Nombre, Email, Teléfono, Coeficiente</strong>.
        </p>
      </div>

      {!result ? (
        <div className="space-y-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`rounded-xl border-2 border-dashed p-16 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
            }`}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <UploadCloud className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            
            {file ? (
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="h-10 w-10 text-green-500 mb-2" />
                <h3 className="font-semibold text-lg">{file.name}</h3>
                <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-lg mb-1">Arrastra tu Excel aquí</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  O haz clic para explorar. Acepta <strong>.xlsx</strong> y <strong>.xls</strong>
                </p>
              </>
            )}

            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </div>

          <div className="flex justify-end gap-3">
            {file && (
              <Button variant="outline" onClick={() => setFile(null)} disabled={isUploading}>
                Cancelar
              </Button>
            )}
            <Button onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? "Procesando..." : "Subir e Importar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-8 text-center space-y-4">
          <div className="flex justify-center mb-2">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-semibold">¡Importación Completada!</h2>
          
          <div className="bg-muted/50 rounded-lg p-6 max-w-sm mx-auto flex flex-col gap-3">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Total de filas procesadas</span>
              <span className="font-bold">{result.total}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Vecinos importados</span>
              <span className="font-bold text-green-600">{result.successCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Errores o duplicados
              </span>
              <span className="font-bold text-red-500">{result.errorCount}</span>
            </div>
          </div>

          <Button className="mt-6" onClick={() => { setResult(null); setFile(null); }}>
            Importar otro archivo
          </Button>
        </div>
      )}
    </div>
  );
}
