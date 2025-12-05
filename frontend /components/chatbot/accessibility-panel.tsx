"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface AccessibilityPanelProps {
  textSize: "normal" | "large" | "xlarge"
  onTextSizeChange: (size: "normal" | "large" | "xlarge") => void
  speechRate: number
  onSpeechRateChange: (rate: number) => void
  onClose: () => void
}

export function AccessibilityPanel({
  textSize,
  onTextSizeChange,
  speechRate,
  onSpeechRateChange,
  onClose,
}: AccessibilityPanelProps) {
  return (
    <div className="bg-secondary border-b border-border p-4 md:p-6" role="region" aria-label="Accessibility settings">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Accessibility Settings</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="min-w-[44px] min-h-[44px]"
          aria-label="Close accessibility settings"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Text Size */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Text Size</Label>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Text size options">
            {(["normal", "large", "xlarge"] as const).map((size) => (
              <Button
                key={size}
                variant={textSize === size ? "default" : "outline"}
                onClick={() => onTextSizeChange(size)}
                className="min-h-[44px] capitalize"
                role="radio"
                aria-checked={textSize === size}
              >
                {size === "xlarge" ? "Extra Large" : size}
              </Button>
            ))}
          </div>
        </div>

        {/* Speech Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="speech-rate" className="text-base font-medium">
              Speech Rate
            </Label>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {speechRate}x
            </span>
          </div>
          <Slider
            id="speech-rate"
            min={0.5}
            max={2}
            step={0.25}
            value={[speechRate]}
            onValueChange={([value]) => onSpeechRateChange(value)}
            className="w-full"
            aria-valuemin={0.5}
            aria-valuemax={2}
            aria-valuenow={speechRate}
            aria-valuetext={`${speechRate} times normal speed`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Slower</span>
            <span>Faster</span>
          </div>
        </div>

        {/* Keyboard Shortcuts Info */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <h3 className="font-medium mb-2">Keyboard Shortcuts</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Space</kbd> — Toggle voice input
            </li>
            <li>
              <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Escape</kbd> — Stop voice input
            </li>
            <li>
              <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Tab</kbd> — Navigate between elements
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
