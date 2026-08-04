import { ImageResponse } from "next/og";
import { createElement } from "react";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
          color: "#042f2e",
          fontSize: 108,
          fontWeight: 800,
          fontFamily: "sans-serif",
        },
      },
      "S"
    ),
    { width: 192, height: 192 }
  );
}
