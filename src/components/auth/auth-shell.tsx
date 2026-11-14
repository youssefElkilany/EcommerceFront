import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Welcome to Dorytos">
        <Link href="/" className="brand-name">dorytos</Link>
        <div className="story-content">
          <span className="story-eyebrow"><Sparkles size={15} /> A LITTLE DISCOVERY. EVERY DAY.</span>
          <h1>Dive into<br />something <em>good.</em></h1>
          <p>Your next favorite find is just around the corner.<br className="desktop-break" /> Make yourself at home.</p>
          <div className="logo-stage">
            <span className="orbit orbit-one" /><span className="orbit orbit-two" />
            <span className="bubble bubble-one" /><span className="bubble bubble-two" />
            <Image src="/dorytos-logo.svg" alt="Dorytos — blue fish logo" width={1600} height={1100} loading="eager" className="hero-logo" />
            <span className="discovery-tag"><span /> GOOD FINDS START HERE</span>
          </div>
        </div>
        <div className="story-footer"><span>A world of finds. One happy place.</span><span>✦</span></div>
      </section>
      <section className="auth-main">
        <header className="auth-top"><Link href="/" className="back-link"><ArrowLeft size={16} /> Back to store</Link><Link href="/" className="mobile-brand"><Image src="/dorytos-logo.svg" alt="Dorytos home" width={88} height={61} loading="eager" /></Link></header>
        <div className="auth-form-wrap">{children}</div>
        <footer className="auth-footer">Made for your everyday discoveries. <span>© Dorytos</span></footer>
      </section>
    </main>
  );
}
