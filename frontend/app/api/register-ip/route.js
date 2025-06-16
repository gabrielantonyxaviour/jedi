import { NextResponse } from "next/server";
import { registerIp } from "../../../utils/story/register";

export async function POST(req) {
  try {
    const body = await req.json();
    // const {
    //   title,
    //   description,
    //   imageURL,
    //   remixFee,
    //   commercialRevShare,
    //   creators,
    //   attributes,
    // } = body;

    // const title = "Test";
    // const description = "Test";
    // const imageURL = "https://via.placeholder.com/150";
    // const remixFee = 0;
    // const commercialRevShare = 0;
    // creators
    // {
    //   name: string;
    //   address: string;
    //   contributionPercent: number;
    // }
    // attributes
    // {
    //   key: string;
    //   value: string;
    // }
    // const creators = [
    //   {
    //     name: "Test Creator",
    //     address: "0x0429A2Da7884CA14E53142988D5845952fE4DF6a",
    //     contributionPercent: 100,
    //   },
    // ];
    const attributes = [
      {
        key: "Test Attribute",
        value: "Test Value",
      },
    ];
    const response = await registerIp({
      title,
      description,
      imageURL,
      remixFee,
      commercialRevShare,
      creators,
      attributes,
    });
    console.log(response);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
