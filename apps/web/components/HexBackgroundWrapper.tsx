"use client";

import dynamic from "next/dynamic";

const HexBackground3D = dynamic(() => import("./HexBackground3D"), { ssr: false });

export default function HexBackgroundWrapper() {
  return <HexBackground3D />;
}
