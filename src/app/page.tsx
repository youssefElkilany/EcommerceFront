import type { Metadata } from "next";
import { Storefront } from "@/components/store/storefront";
import "./store.css";
export const metadata: Metadata = { title: "Dorytos | Dive into your next favorite find", description: "Explore categories and discover your next favorite find at Dorytos." };
export default function Home() { return <Storefront />; }
