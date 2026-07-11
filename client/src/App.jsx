import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { LoaderCircle } from "lucide-react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Wardrobe from "./pages/Wardrobe";
import Outfits from "./pages/Outfits";
import Collections from "./pages/Collections";
import { api, uploadImage } from "./services/api";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 10 * 1024 * 1024;

async function convertAvifToPng(file) {
  if (file.type !== "image/avif") return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");

  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Conversion AVIF impossible.");
  }

  context.drawImage(bitmap, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Conversion AVIF impossible."));
      },
      "image/png",
      1
    );
  });

  bitmap.close();

  return new File(
    [blob],
    `${file.name.replace(/\.[^.]+$/, "")}.png`,
    { type: "image/png" }
  );
}

export default function App() {
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [notification, setNotification] = useState("");

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (event) => {
      event.preventDefault();
      dragCounter += 1;

      if (event.dataTransfer?.types?.includes("Files")) {
        setDragging(true);
      }
    };

    const handleDragLeave = (event) => {
      event.preventDefault();
      dragCounter -= 1;

      if (dragCounter <= 0) {
        dragCounter = 0;
        setDragging(false);
      }
    };

    const handleDragOver = (event) => {
      event.preventDefault();
    };

   const handleDrop = async (event) => {
  event.preventDefault();
  dragCounter = 0;
  setDragging(false);

  const files = Array.from(event.dataTransfer?.files || []);

  if (files.length === 0) return;

  setProcessing(true);
  setProcessingStatus(`Préparation de ${files.length} vêtement${files.length > 1 ? "s" : ""}…`);

  let added = 0;
  let failed = 0;

  try {
    const { removeBackground } = await import(
      "@imgly/background-removal"
    );

    for (const [index, file] of files.entries()) {
      try {
        setProcessingStatus(`Traitement du vêtement ${index + 1} sur ${files.length}…`);
        if (!ACCEPTED_TYPES.includes(file.type)) {
          failed += 1;
          continue;
        }

        if (file.size > MAX_SIZE) {
          failed += 1;
          continue;
        }

        const compatibleFile = await convertAvifToPng(file);

        const blob = await removeBackground(compatibleFile, {
          output: {
            format: "image/png",
            quality: 1,
          },
        });

        const cutoutFile = new File(
          [blob],
          `${file.name.replace(/\.[^.]+$/, "")}-detouree.png`,
          { type: "image/png" }
        );

        const { imageUrl } = await uploadImage(cutoutFile);

        setProcessingStatus(`Ajout du vêtement ${index + 1} sur ${files.length}…`);
        await api("/clothes", {
          method: "POST",
          body: JSON.stringify({
            name: "",
            category: "",
            brand: "",
            color: "",
            season: [],
            style: "",
            size: "",
            imageUrl,
            favorite: false,
          }),
        });

        added += 1;
      } catch (error) {
        console.error(`Erreur sur ${file.name}`, error);
        failed += 1;
      }
    }

    window.dispatchEvent(new Event("clothes-updated"));

    if (failed === 0) {
      showNotification(
        `${added} vêtement${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""}.`
      );
    } else {
      showNotification(
        `${added} ajouté${added > 1 ? "s" : ""}, ${failed} échec${failed > 1 ? "s" : ""}.`
      );
    }
  } catch (error) {
    console.error(error);
    showNotification("Impossible de traiter les images.");
  } finally {
    setProcessing(false);
    setProcessingStatus("");
  }
};

    const showNotification = (message) => {
      setNotification(message);

      window.clearTimeout(window.wearsenseNotificationTimer);

      window.wearsenseNotificationTimer = window.setTimeout(() => {
        setNotification("");
      }, 3000);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="wardrobe" element={<Wardrobe />} />
            <Route path="outfits" element={<Outfits />} />
            <Route path="collections" element={<Collections />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      </BrowserRouter>

      {dragging && (
        <div className="global-drop-overlay">
          <div>
            <strong>Déposez l’image</strong>
            <span>Le vêtement sera détouré et ajouté automatiquement</span>
          </div>
        </div>
      )}

      {processing && (
        <div className="global-processing" role="status" aria-live="polite">
          <LoaderCircle className="spin" size={18} aria-hidden="true" />
          <span>{processingStatus || "Traitement en cours…"}</span>
        </div>
      )}

      {notification && (
        <div className="global-notification">
          {notification}
        </div>
      )}
    </>
  );
}
