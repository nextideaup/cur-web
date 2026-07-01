import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Vault 1",
  description: "How Vault 1 collects, uses, and protects your information.",
};

// Public, standalone page (excluded from the auth middleware + the app shell) so
// it's reachable by the eBay OAuth consent screen and eBay's app review without
// a Vault 1 login. Boilerplate policy tailored to what the app actually does.
const LAST_UPDATED = "July 1, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="h-screen overflow-y-auto bg-background text-text">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-xs text-accent hover:underline">← Back to Vault 1</Link>

        <h1 className="mt-6 text-3xl font-bold text-text">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-dim">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-text-muted">
          This Privacy Policy explains how Vault 1 (“Vault 1,” “we,” “us,” or “our”), available at
          vault1.co, collects, uses, and protects your information when you use the service. By using
          Vault 1 you agree to the practices described here.
        </p>

        <Section title="Who we are">
          <p>
            Vault 1 is a personal tool for tracking high-end collections — guitars, watches,
            automobiles, and other items of distinction — including valuations, insurance records, and,
            where you choose, drafting listings to third-party marketplaces.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>We collect only what we need to provide the service:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-text">Account information</strong> — your email address and name,
              provided directly or via a sign-in provider (e.g. Google or Apple) when you create an
              account.
            </li>
            <li>
              <strong className="text-text">Collection content</strong> — the items, descriptions,
              specifications, photos, valuations, and notes you add to your collection.
            </li>
            <li>
              <strong className="text-text">Marketplace connections</strong> — when you connect a
              marketplace (such as Reverb or eBay), the access credentials needed to act on your behalf,
              stored encrypted (see “Marketplace connections” below).
            </li>
            <li>
              <strong className="text-text">Technical data</strong> — basic logs and session information
              needed to operate and secure the service.
            </li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To provide and maintain your collection, valuations, and records.</li>
            <li>To generate AI-assisted valuations and item specifications when you request them.</li>
            <li>To create draft or published listings on marketplaces you connect, at your direction.</li>
            <li>To secure your account and improve the reliability of the service.</li>
          </ul>
        </Section>

        <Section title="We do not sell your data">
          <p>
            We do not sell, rent, or trade your personal information or collection data to anyone. We do
            not use your data for third-party advertising.
          </p>
        </Section>

        <Section title="When we share information">
          <p>
            We share information only with service providers that help us run Vault 1, and only as needed
            to provide the features you use:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-text">AI provider (Anthropic)</strong> — item details you submit
              for AI valuation or specification lookups are processed to return a result.
            </li>
            <li>
              <strong className="text-text">Image &amp; data hosting</strong> — your images and data are
              stored with our hosting and object-storage providers.
            </li>
            <li>
              <strong className="text-text">Sign-in providers</strong> — to authenticate you when you
              choose to sign in with them.
            </li>
            <li>
              <strong className="text-text">Marketplaces you connect</strong> — when you create a
              listing, the relevant item information is sent to that marketplace (e.g. Reverb, eBay) to
              create it on your behalf. We only do this for actions you initiate.
            </li>
          </ul>
          <p>
            We may also disclose information if required by law, or to protect the rights, safety, and
            security of our users and the service.
          </p>
        </Section>

        <Section title="Marketplace connections">
          <p>
            When you connect a marketplace account, we store the access and refresh tokens needed to
            create listings <strong className="text-text">encrypted at rest</strong>. These credentials
            are used only to perform actions you initiate (such as drafting a listing), and never to
            access your marketplace account for any other purpose. You can disconnect a marketplace at any
            time from the app, which deletes the stored credentials.
          </p>
          <p>
            If you disconnect or delete your eBay account, eBay may notify us and we will remove the
            associated data we hold for that connection.
          </p>
        </Section>

        <Section title="Data retention and deletion">
          <p>
            We retain your information for as long as your account is active. You can delete individual
            items and images at any time. To delete your account and associated data, contact us at the
            address below and we will remove your data, except where we are required to retain it by law.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use industry-standard measures to protect your information, including encryption in transit
            and encryption at rest for sensitive credentials. No method of transmission or storage is
            completely secure, but we work to protect your data and limit access to it.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use a small number of cookies that are necessary to keep you signed in and to operate the
            service. We do not use advertising or third-party tracking cookies.
          </p>
        </Section>

        <Section title="Children's privacy">
          <p>
            Vault 1 is not directed to children under 16, and we do not knowingly collect personal
            information from children. If you believe a child has provided us information, contact us and
            we will delete it.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the “Last
            updated” date above. Your continued use of Vault 1 after a change means you accept the updated
            policy.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            If you have questions about this Privacy Policy or your data, contact us at{" "}
            <a href="mailto:privacy@vault1.co" className="text-accent hover:underline">privacy@vault1.co</a>.
          </p>
        </Section>

        <p className="mt-12 border-t border-border pt-6 text-xs text-text-dim">© {2026} Vault 1. All rights reserved.</p>
      </div>
    </main>
  );
}
