"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Play } from "lucide-react";

export function VideoBloque({ videoUrl, heroImg }: { videoUrl: string; heroImg: string }) {
  const [reproducir, setReproducir] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const esArchivo = /\.(mp4|webm|mov)(\?|$)/i.test(videoUrl);
  const esYoutube = /youtu\.?be/i.test(videoUrl);
  const embedYoutube = esYoutube
    ? videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")
    : "";

  return (
    <div className="arca-gradborder mx-auto max-w-4xl">
      <div className="relative aspect-video min-h-[340px] overflow-hidden rounded-[16px] border border-white/12 bg-[#0c0518]">
        {reproducir && esArchivo && (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        )}
        {reproducir && esYoutube && (
          <iframe
            src={`${embedYoutube}?autoplay=1`}
            title="Presentación de ARCA"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        )}
        {!reproducir && (
          <button
            type="button"
            onClick={() => setReproducir(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.35),rgba(12,5,24,0.9))]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#160827] shadow-[0_18px_50px_rgba(124,58,237,0.5)] transition group-hover:scale-110">
              <Play size={26} fill="currentColor" className="ml-1" />
            </span>
            <span className="text-[14px] font-medium text-white/85">
              {videoUrl ? "Reproducir presentación" : "Video de presentación (próximamente)"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
