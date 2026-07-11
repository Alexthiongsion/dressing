import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Scissors, Trash2, Upload } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export default function ImageDropzone({ initialUrl = "", onChange }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initialUrl);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPreview(initialUrl || "");
    setFile(null);
  }, [initialUrl]);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const selectFile = (nextFile) => {
    setError("");
    if (!nextFile) return;
    if (!ACCEPTED.includes(nextFile.type)) return setError("Format accepté : JPG, PNG ou WebP.");
    if (nextFile.size > MAX_SIZE) return setError("L’image ne doit pas dépasser 10 Mo.");
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setPreview(url);
    onChange(nextFile);
  };

  const removeBackground = async () => {
    if (!file) return setError("Ajoutez d’abord une image depuis votre ordinateur.");
    setProcessing(true);
    setError("");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(file, { output: { format: "image/png", quality: 1 } });
      const cleanFile = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-detouree.png`, { type: "image/png" });
      selectFile(cleanFile);
    } catch (err) {
      console.error(err);
      setError("Le détourage a échoué. Gardez l’originale ou réessayez avec une image plus nette.");
    } finally {
      setProcessing(false);
    }
  };

  const clear = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setError("");
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return <div className="image-uploader full">
    <div
      className={`dropzone ${dragging ? "dragging" : ""} ${preview ? "has-image" : ""}`}
      onDragEnter={e => { e.preventDefault(); setDragging(true); }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={e => { e.preventDefault(); setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files?.[0]); }}
      onClick={() => !preview && inputRef.current?.click()}
    >
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp, image/avif" onChange={e => selectFile(e.target.files?.[0])}/>
      {preview ? <img src={preview} alt="Aperçu du vêtement"/> : <div className="dropzone-empty"><ImagePlus size={34}/><strong>Glissez une image ici</strong><span>ou cliquez pour parcourir · JPG, PNG, WebP · 10 Mo max</span></div>}
    </div>
    {preview && <div className="image-actions">
      <button type="button" onClick={() => inputRef.current?.click()}><Upload size={16}/> Remplacer</button>
      <button type="button" onClick={removeBackground} disabled={processing || !file}>{processing ? <LoaderCircle className="spin" size={16}/> : <Scissors size={16}/>} {processing ? "Détourage…" : "Détourer le fond"}</button>
      <button type="button" className="danger" onClick={clear}><Trash2 size={16}/> Retirer</button>
    </div>}
    {error && <p className="field-error">{error}</p>}
    {processing && <p className="field-hint">Le premier détourage télécharge le modèle dans votre navigateur et peut être plus lent.</p>}
  </div>;
}
