/*import {
    owner
} from "./services/blockchainService.js";

async function main() {

    const result =
        await owner();

    console.log(result);

}

main();

import {
    verifyCredential
} from "./services/blockchainService.js";

async function main() {

    const hash =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

    const result =
        await verifyCredential(hash);

    console.log(result);

}

main();*/

//supabase test

import supabase from "./services/supabaseService.js";

async function main() {

    const { data, error } =
        await supabase
        .from("credentials")
        .select("*");

    console.log(data);
    console.log(error);

}

main();