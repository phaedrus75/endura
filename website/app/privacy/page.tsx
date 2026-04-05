import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Endura",
  description: "Privacy Policy for the Endura study app.",
};

export default function PrivacyPolicy() {
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

      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-forest-dark mb-2">
          Privacy Policy
        </h1>
        <p className="text-bark/60 mb-12">Last updated: 30 March 2026</p>

        <div className="space-y-10 text-bark/80 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              1. Introduction
            </h2>
            <p>
              Endura (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a
              gamified study app that turns focus time into conservation impact.
              This Privacy Policy explains how we collect, use, and protect your
              information when you use our mobile application and website
              (collectively, the &quot;Service&quot;).
            </p>
            <p className="mt-3">
              By using Endura, you agree to the collection and use of
              information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              2. Information We Collect
            </h2>

            <h3 className="text-lg font-medium text-forest mb-2">
              Account Information
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address (for account creation and login)</li>
              <li>Username (chosen by you, displayed to friends)</li>
              <li>
                Password (stored securely using industry-standard hashing)
              </li>
              <li>
                Profile picture (optional, uploaded by you)
              </li>
              <li>School, city, and country (optional, provided by you)</li>
            </ul>

            <h3 className="text-lg font-medium text-forest mt-4 mb-2">
              Study Data
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Study session duration and timestamps</li>
              <li>Subjects studied</li>
              <li>To-do lists and tasks you create</li>
              <li>
                Study streaks, coins earned, and animals hatched (game
                progress)
              </li>
            </ul>

            <h3 className="text-lg font-medium text-forest mt-4 mb-2">
              Social Data
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Friend connections (when you add friends)</li>
              <li>Study group memberships and group activity</li>
              <li>Leaderboard rankings</li>
              <li>Study tips you submit, and your likes on others&apos; tips</li>
            </ul>

            <h3 className="text-lg font-medium text-forest mt-4 mb-2">
              Device Information
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                Push notification token (only if you enable notifications)
              </li>
              <li>Notification preferences and reminder settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and maintain the Service</li>
              <li>To track your study progress and game achievements</li>
              <li>
                To enable social features (friends, groups, leaderboards)
              </li>
              <li>
                To send push notifications (study reminders, streak alerts) when
                enabled
              </li>
              <li>
                To improve the app and fix bugs
              </li>
              <li>
                To communicate important updates about the Service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              4. Data Sharing
            </h2>
            <p>We do not sell your personal information. We share data only in these limited cases:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>With other users:</strong> Your username, profile
                picture, study stats, and animal collection are visible to your
                friends. Leaderboard rankings are visible to group members.
              </li>
              <li>
                <strong>WWF donations:</strong> If you choose to donate to WWF
                through the app, you are redirected to WWF&apos;s own donation
                page. We do not collect or store any payment information.
              </li>
              <li>
                <strong>Service providers:</strong> We use Railway for hosting
                and Expo/EAS for app distribution. These providers may process
                data as needed to operate the Service.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose information
                if required by law or to protect the rights and safety of our
                users.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              5. Data Security
            </h2>
            <p>
              We take reasonable measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Passwords are hashed using industry-standard algorithms</li>
              <li>Authentication tokens (JWT) are used for secure sessions</li>
              <li>HTTPS encryption for all data in transit</li>
              <li>
                Rate limiting and brute-force protection on login and password
                reset
              </li>
            </ul>
            <p className="mt-3">
              No method of transmission or storage is 100% secure. While we
              strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              6. Data Retention
            </h2>
            <p>
              We retain your account data and study history for as long as your
              account is active. If you wish to delete your account and all
              associated data, please contact us at{" "}
              <a
                href="mailto:hello@endura.eco"
                className="text-forest underline hover:text-forest-dark"
              >
                hello@endura.eco
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              7. Children&apos;s Privacy
            </h2>
            <p>
              Endura is designed for students of all ages. We do not knowingly
              collect sensitive personal information from children under 13
              beyond what is described in this policy (email, username, study
              data). If you are a parent or guardian and believe your child has
              provided us with information you did not consent to, please contact
              us and we will take steps to remove it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              8. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of push notifications at any time via app settings</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a
                href="mailto:hello@endura.eco"
                className="text-forest underline hover:text-forest-dark"
              >
                hello@endura.eco
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              9. Third-Party Links
            </h2>
            <p>
              The app contains links to WWF&apos;s donation page and may link to
              external resources. We are not responsible for the privacy
              practices of third-party websites. We encourage you to review
              their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of significant changes by posting the new policy on
              this page and updating the &quot;Last updated&quot; date. Your
              continued use of the Service after changes constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-dark mb-3">
              11. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us:
            </p>
            <p className="mt-2">
              <a
                href="mailto:hello@endura.eco"
                className="text-forest underline hover:text-forest-dark"
              >
                hello@endura.eco
              </a>
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-sage/20 text-center text-sm text-bark/40">
          © 2026 Endura. All rights reserved.
        </div>
      </article>
    </main>
  );
}
