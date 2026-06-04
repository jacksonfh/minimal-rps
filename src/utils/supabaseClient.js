import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xigbtastronhqusomlir.supabase.co";
const supabaseKey = "sb_publishable_0_ieZXNIhI-snLR7D3YD9A_DQ35B0ad";

export const supabase = createClient(supabaseUrl, supabaseKey);
