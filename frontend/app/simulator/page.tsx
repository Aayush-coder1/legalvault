import type { Metadata } from "next";
import { SimulatorClient } from "./simulator-client";

export const metadata: Metadata = { title: "Simulator · LegalVault" };

export default function SimulatorPage() {
  return <SimulatorClient />;
}
