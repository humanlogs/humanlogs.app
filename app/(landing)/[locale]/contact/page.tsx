"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectOption } from "@/components/ui/select";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { AnimatedSectionTitle } from "../components/animated-section-title";
import { FAQSection } from "../components/sections";

const USE_CASE_OPTIONS: SelectOption[] = [
  { value: "journalism", label: "Journalism" },
  { value: "legal", label: "Legal" },
  { value: "government", label: "Government" },
  { value: "research", label: "Research" },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    organization: "",
    useCase: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitStatus("success");
      setFormData({
        fullName: "",
        email: "",
        organization: "",
        useCase: "",
        message: "",
      });
    } catch (error) {
      setSubmitStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-16 md:px-6">
        <div className="mx-auto max-w-2xl">
          <AnimatedSectionTitle subtitle="Have questions or want to learn more? We'd love to hear from you.">
            Contact Us
          </AnimatedSectionTitle>

          {/* Form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
            {submitStatus === "success" ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-black">
                  Message Sent!
                </h2>
                <p className="mb-6 text-gray-600">
                  We've received your message and will get back to you soon.
                  Check your email for a confirmation.
                </p>
                <Button
                  onClick={() => setSubmitStatus("idle")}
                  variant="outline"
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="John Doe"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="john@example.com"
                    required
                  />
                </div>

                {/* Organization */}
                <div className="space-y-2">
                  <Label htmlFor="organization">
                    University or Company{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="organization"
                    type="text"
                    value={formData.organization}
                    onChange={(e) =>
                      setFormData({ ...formData, organization: e.target.value })
                    }
                    placeholder="Harvard University"
                    required
                  />
                </div>

                {/* Use Case */}
                <div className="space-y-2">
                  <Label htmlFor="useCase">
                    Use Case <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    options={USE_CASE_OPTIONS}
                    value={formData.useCase}
                    onChange={(value) =>
                      setFormData({ ...formData, useCase: value })
                    }
                    placeholder="Select your use case..."
                    searchPlaceholder="Search use cases..."
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">
                    Message <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    placeholder="Tell us about your project and how we can help..."
                    rows={6}
                    required
                    className="resize-none"
                  />
                </div>

                {/* Error Message */}
                {submitStatus === "error" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    {errorMessage}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-black text-white hover:bg-gray-800"
                  size="lg"
                  disabled={isSubmitting || !formData.useCase}
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <FAQSection />
    </main>
  );
}
