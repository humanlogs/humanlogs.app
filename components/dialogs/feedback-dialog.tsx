"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useModal } from "@/components/use-modal";
import { useTranslations } from "@/components/locale-provider";
import { StarIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type FeedbackModalMode = "rating" | "feature-request";

export type FeedbackModalData = {
  mode?: FeedbackModalMode;
};

export function useFeedbackModal() {
  return useModal<FeedbackModalData>("feedback-modal");
}

export function FeedbackDialog() {
  const { isOpen, data, close } = useFeedbackModal();
  const t = useTranslations("feedback");
  const mode = data?.mode || "rating";

  const [rating, setRating] = React.useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showThankYou, setShowThankYou] = React.useState(false);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setRating(null);
      setHoveredRating(null);
      setMessage("");
      setIsSubmitting(false);
      setShowThankYou(false);
    }
  }, [isOpen]);

  const handleStarClick = async (star: number) => {
    setRating(star);

    // Immediately save the rating
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "RATING",
          rating: star,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save rating");
      }

      // If rating is 3 or higher, show thank you screen
      if (star >= 3) {
        setShowThankYou(true);
      } else {
        setShowThankYou(false);
      }
    } catch (error) {
      console.error("Error saving rating:", error);
      toast.error(
        error instanceof Error ? error.message : t("errors.submitFailed"),
      );
    }
  };

  const handleSubmitFeedback = async () => {
    if (mode === "rating" && rating === null) {
      toast.error(t("errors.ratingRequired"));
      return;
    }

    if (mode === "rating" && rating !== null && rating < 3 && !message.trim()) {
      toast.error(t("errors.messageRequired"));
      return;
    }

    if (mode === "feature-request" && !message.trim()) {
      toast.error(t("errors.featureMessageRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: mode === "rating" ? "RATING" : "FEATURE_REQUEST",
          rating: mode === "rating" ? rating : undefined,
          message: message.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit feedback");
      }

      toast.success(
        mode === "feature-request" ? t("featureSuccess") : t("success"),
      );
      close();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error(
        error instanceof Error ? error.message : t("errors.submitFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishReview = () => {
    window.open("http://trustpilot.com/", "_blank");
    close();
  };

  const handleLeaveReview = () => {
    window.open("http://trustpilot.com/", "_blank");
    close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "feature-request" ? t("featureTitle") : t("title")}
          </DialogTitle>
          <DialogDescription>
            {mode === "feature-request"
              ? t("featureDescription")
              : t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-2">
          {/* Star Rating - only for rating mode */}
          {mode === "rating" && !showThankYou && (
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleStarClick(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(null)}
                    className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                    disabled={isSubmitting}
                  >
                    <StarIcon
                      className={cn(
                        "w-10 h-10 transition-colors",
                        (
                          hoveredRating !== null
                            ? star <= hoveredRating
                            : rating !== null && star <= rating
                        )
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                ))}
              </div>
              {rating !== null && (
                <p className="text-sm text-muted-foreground">
                  {t(`ratings.${rating}`)}
                </p>
              )}
            </div>
          )}

          {/* Thank You Screen for good ratings */}
          {mode === "rating" && showThankYou && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon
                    key={star}
                    className={cn(
                      "w-10 h-10",
                      rating !== null && star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground",
                    )}
                  />
                ))}
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">{t("thankYou")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("thankYouMessage")}
                </p>
              </div>
            </div>
          )}

          {/* Feedback Form for low ratings */}
          {mode === "rating" && rating !== null && rating < 3 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="feedback-message"
                  className="text-sm font-medium"
                >
                  {t("messageLabel")}
                </label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("messagePlaceholder")}
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>

              <button
                onClick={handleLeaveReview}
                className="text-sm text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                type="button"
              >
                {t("leaveReview")}
              </button>
            </div>
          )}

          {/* Feature Request Form */}
          {mode === "feature-request" && (
            <div className="space-y-2">
              <label htmlFor="feature-message" className="text-sm font-medium">
                {t("featureMessageLabel")}
              </label>
              <Textarea
                id="feature-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("featureMessagePlaceholder")}
                rows={6}
                disabled={isSubmitting}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {((mode === "rating" && showThankYou) ||
          (mode === "rating" && rating !== null && rating < 3) ||
          mode === "feature-request") && (
          <DialogFooter>
            {mode === "rating" && showThankYou ? (
              <>
                <Button variant="outline" onClick={close}>
                  {t("close")}
                </Button>
                <Button onClick={handlePublishReview}>
                  {t("publishReview")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={close}
                  disabled={isSubmitting}
                >
                  {t("cancel")}
                </Button>
                <Button onClick={handleSubmitFeedback} disabled={isSubmitting}>
                  {isSubmitting ? t("submitting") : t("submit")}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
