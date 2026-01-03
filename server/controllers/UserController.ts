import { Request, Response } from "express";
import Thumbnail from "../models/Thumbnail.js";

//controllers to get all user thumbnails
export const getUserThumbnails = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const thumbnail = await Thumbnail.find({ userId }).sort({ createdAt: -1 });
    res.json({ thumbnail });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

//controller to get single thumbnail by user
export const getThumbnailById = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { id } = req.params;
    const thumbnail = await Thumbnail.findOne({ userId, _id: id });
    res.json({ thumbnail });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
