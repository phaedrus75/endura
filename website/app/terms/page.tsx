import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use — Endura",
  description: "Terms of Use for the Endura study app.",
};

export default function TermsOfUse() {
  return (
    <main className="min-h-screen bg-cream">
      <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md border-b border-sage/20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-forest-dark">
            🌿 endura
          </Link>
          <Link
            href="/"
            className="text-sm text-forest hover:text-forest-dark transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold text-forest-dark mb-2">
          Terms of Use
        </h1>
        <p className="text-sm text-forest/60 mb-8">
          Last updated: April 8, 2026
        </p>

        <div className="prose prose-sm prose-forest max-w-none space-y-6 text-forest-dark/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By downloading, installing, or using the Endura mobile application
              (&quot;App&quot;), you agree to be bound by these Terms of Use
              (&quot;Terms&quot;). If you do not agree to these Terms, do not use
              the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              2. Eligibility
            </h2>
            <p>
              Endura is designed for students aged 13 and above. By using the
              App, you confirm that you are at least 13 years old. If you are
              under 16 and located in the European Union, you confirm that you
              have obtained parental or guardian consent to use the App, as
              required by the General Data Protection Regulation (GDPR). If you
              are under 18, we encourage you to review these Terms with a
              parent or guardian.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              3. Account Registration
            </h2>
            <p>
              You must create an account to use the App. You are responsible for
              maintaining the confidentiality of your login credentials and for
              all activities under your account. You agree to provide accurate
              information during registration and to keep it up to date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              4. Community Guidelines
            </h2>
            <p>
              Endura is a supportive study community. You agree not to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                Post, share, or communicate any content that is offensive,
                abusive, harassing, hateful, sexually explicit, discriminatory,
                or otherwise objectionable.
              </li>
              <li>
                Impersonate another person or misrepresent your identity.
              </li>
              <li>
                Use the App to spam, distribute malware, or engage in any
                unlawful activity.
              </li>
              <li>
                Attempt to access other users&apos; accounts or private
                information.
              </li>
              <li>
                Interfere with or disrupt the App&apos;s services or servers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              5. User-Generated Content
            </h2>
            <p>
              You are solely responsible for any content you create within the
              App, including but not limited to usernames, profile pictures,
              group names, chat messages, and study group descriptions. We
              reserve the right to remove any content that violates these Terms
              without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              6. Reporting and Blocking
            </h2>
            <p>
              The App provides mechanisms to report objectionable content and
              block abusive users. When you block a user, they are removed from
              your friends list and their content is hidden from your feed. All
              reports are reviewed by our team.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              7. Intellectual Property
            </h2>
            <p>
              All content, features, and functionality of the App (including but
              not limited to text, graphics, logos, animal illustrations, and
              software) are owned by Endura and are protected by copyright and
              other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              8. Donations
            </h2>
            <p>
              Donations made through the App are processed by Every.org and go
              directly to the World Wildlife Fund (WWF). Endura does not
              process, store, or have access to your payment information.
              Donations are non-refundable and subject to Every.org&apos;s terms
              of service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              9. Account Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate your account at any
              time, without prior notice, if we determine that you have violated
              these Terms or engaged in behaviour that is harmful to other users
              or the community.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              10. Disclaimer of Warranties
            </h2>
            <p>
              The App is provided &quot;as is&quot; and &quot;as available&quot;
              without warranties of any kind, either express or implied. We do
              not guarantee that the App will be uninterrupted, error-free, or
              secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              11. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, Endura shall not be liable
              for any indirect, incidental, special, or consequential damages
              arising from your use of the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              12. Changes to Terms
            </h2>
            <p>
              We may update these Terms from time to time. Continued use of the
              App after changes constitutes acceptance of the revised Terms. We
              will notify users of significant changes through the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              13. Contact
            </h2>
            <p>
              If you have questions about these Terms, contact us at{" "}
              <a
                href="mailto:hello@endura.eco"
                className="text-forest font-semibold hover:underline"
              >
                hello@endura.eco
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-forest-dark mt-8 mb-3">
              14. Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of England and Wales.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-sage/20 text-center">
          <p className="text-sm text-forest/50">
            © 2026 Endura. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
