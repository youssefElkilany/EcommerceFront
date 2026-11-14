import type { Metadata } from "next";
import { CartPage } from "@/components/store/cart-page";
import "../store.css";
export const metadata: Metadata = { title: "Your cart | Dorytos" };
export default function Page() { return <CartPage />; }
