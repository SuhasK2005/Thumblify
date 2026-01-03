import { Request, Response } from "express";
import Thumbnail from "../models/Thumbnail.js";
import {
  GenerateContentConfig,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/genai";
import ai from "../configs/ai.js";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

const stylePrompts = {
  "Bold & Graphic":
    "eye-catching thumbnail, bold typography, vibrant colors, expressive facial reactions, dramatic lighting, high contrast, click-worthy composition, professional style",
  "Tech/Futuristic":
    "futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, sharp lighting, high-tech atmosphere",
  Minimalist:
    "minimalist thumbnail, clean layout, simple shapes, limited color palette, plenty of negative space, modern flat design, clear focal point",
  Photorealistic:
    "photorealistic thumbnail, ultra-realistic lighting, natural skin tones, candid moment, DSLR-style photography, lifestyle realism, shallow depth of field",
  Illustrated:
    "illustrated thumbnail, custom digital illustration, stylized characters, bold outlines, vibrant colors, creative cartoon or vector art style",
};

const colorSchemeDescriptions = {
  vibrant:
    "vibrant and energetic colors, high saturation, bold contrasts, eye-catching palette",
  sunset:
    "warm sunset tones, orange pink and purple hues, soft gradients, cinematic glow",
  forest:
    "natural green tones, earthy colors, calm and organic palette, fresh atmosphere",
  neon: "neon glow effects, electric blues and pinks, cyberpunk lighting, high contrast glow",
  purple:
    "purple-dominant color palette, magenta and violet tones, modern and stylish mood",
  monochrome:
    "black and white color scheme, high contrast, dramatic lighting, timeless aesthetic",
  ocean:
    "cool blue and teal tones, aquatic color palette, fresh and clean atmosphere",
  pastel:
    "soft pastel colors, low saturation, gentle tones, calm and friendly aesthetic",
};

export const generateThumbnail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const {
      title,
      prompt: user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
    } = req.body;

    const thumbnail = await Thumbnail.create({
      userId,
      title,
      prompt_used: user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
      isGenerating: true,
    });

    const model = "gemini-3-pro-image-preview";

    const generationConfig: GenerateContentConfig = {
      maxOutputTokens: 32768,
      temperature: 1,
      topP: 0.95,
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: aspect_ratio || "16:9",
        imageSize: "1K",
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.OFF,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.OFF,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.OFF,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.OFF,
        },
      ],
    };

    let prompt = `Create a ${
      stylePrompts[style as keyof typeof stylePrompts]
    } for: "${title}"`;
    if (color_scheme) {
      prompt += ` Use a ${
        colorSchemeDescriptions[
          color_scheme as keyof typeof colorSchemeDescriptions
        ]
      } color scheme.`;
    }
    if (user_prompt) {
      prompt += ` Additional details: ${user_prompt}`;
    }

    prompt += ` The thumbnail should be ${aspect_ratio}, visually stunning, and designed to maximize click-through rate. Make it bold, professional, and impossible to ignore.`;

    console.log("=== GENERATION REQUEST ===");
    console.log("Prompt:", prompt);
    console.log("Model:", model);

    // Generate the image using the GenAI
    const response: any = await ai.models.generateContent({
      model,
      contents: [prompt],
      config: generationConfig,
    });

    console.log("=== API RESPONSE ===");
    console.log("Response structure:", JSON.stringify(response, null, 2));
    console.log("Has candidates?", !!response?.candidates);
    console.log("Candidates length:", response?.candidates?.length);

    if (!response?.candidates?.[0]?.content?.parts) {
      console.error("ERROR: No parts found in response");
      console.error("Full response:", JSON.stringify(response, null, 2));
      throw new Error("Unexpected response structure - no parts found");
    }

    const parts = response.candidates[0].content.parts;
    console.log("=== PARTS ANALYSIS ===");
    console.log("Number of parts:", parts.length);

    let finalBuffer: Buffer | null = null;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`Part ${i}:`, Object.keys(part));

      if (part.text) {
        console.log(`  - Text content: ${part.text.substring(0, 100)}...`);
      }

      if (part.inlineData) {
        console.log(`  - InlineData found!`);
        console.log(`  - MimeType: ${part.inlineData.mimeType}`);
        console.log(
          `  - Data length: ${part.inlineData.data?.length || 0} chars`
        );
        finalBuffer = Buffer.from(part.inlineData.data, "base64");
        console.log(`  - Buffer size: ${finalBuffer.length} bytes`);
        break;
      }

      if (part.image) {
        console.log(`  - Image data found!`);
        finalBuffer = Buffer.from(part.image.data, "base64");
        console.log(`  - Buffer size: ${finalBuffer.length} bytes`);
        break;
      }
    }

    if (!finalBuffer) {
      console.error("ERROR: No image data found in any part");
      console.error("All parts:", JSON.stringify(parts, null, 2));
      throw new Error(
        "No image data generated - model may have returned text instead"
      );
    }

    console.log("=== FILE OPERATIONS ===");
    const filename = `final-output-${Date.now()}.png`;
    const filePath = path.join("images", filename);
    console.log("Saving to:", filePath);

    fs.mkdirSync("images", { recursive: true });
    fs.writeFileSync(filePath, finalBuffer);
    console.log("File saved successfully");

    console.log("=== CLOUDINARY UPLOAD ===");
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: "image",
    });
    console.log("Cloudinary URL:", uploadResult.url);

    thumbnail.image_url = uploadResult.url;
    thumbnail.isGenerating = false;
    await thumbnail.save();

    res.json({ message: "Thumbnail Generated", thumbnail });

    fs.unlinkSync(filePath);
    console.log("=== SUCCESS ===");
  } catch (error: any) {
    console.error("=== ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Try to update thumbnail error state
    try {
      const { userId } = req.session;
      const failedThumbnail = await Thumbnail.findOne({
        userId,
        isGenerating: true,
      }).sort({ createdAt: -1 });

      if (failedThumbnail) {
        failedThumbnail.isGenerating = false;
        await failedThumbnail.save();
      }
    } catch (updateError) {
      console.error("Failed to update thumbnail state:", updateError);
    }

    res.status(500).json({ message: error.message });
  }
};

//delete thumbnail controller
export const deleteThumbnail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session;

    await Thumbnail.findByIdAndDelete({ _id: id, userId });
    res.json({ message: "Thumbnail Deleted Successfully" });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
