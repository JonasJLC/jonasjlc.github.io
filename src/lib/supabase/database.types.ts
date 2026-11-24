// Table types from the live schema (Supabase MCP `generate_typescript_types`, 2026-11-15), reformatted. `Relationships`
// is loosened to a plain list, so embedded selects (`select('*, sp_recipe_ingredients(*)')`) are not inferred from it.
// For the exact generated file, regenerate after every migration:
//   supabase gen types typescript --linked > src/lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' };
  public: {
    Tables: {
      feature_chat_calls: {
        Row: { called_at: string; id: number; user_id: string };
        Insert: { called_at?: string; id?: never; user_id: string };
        Update: { called_at?: string; id?: never; user_id?: string };
        Relationships: [];
      };
      feature_requests: {
        Row: {
          app: string
          created_at: string; created_by: string | null; created_by_name: string; details: Json;
          github_issue_number: number | null; github_issue_url: string | null; household_id: string; id: string;
          owner_note: string | null; status: string; summary: string; title: string; transcript: Json; updated_at: string;
        };
        Insert: {
          app?: string
          created_at?: string; created_by?: string | null; created_by_name?: string; details?: Json;
          github_issue_number?: number | null; github_issue_url?: string | null; household_id: string; id?: string;
          owner_note?: string | null; status?: string; summary: string; title: string; transcript?: Json; updated_at?: string;
        };
        Update: {
          app?: string
          created_at?: string; created_by?: string | null; created_by_name?: string; details?: Json;
          github_issue_number?: number | null; github_issue_url?: string | null; household_id?: string; id?: string;
          owner_note?: string | null; status?: string; summary?: string; title?: string; transcript?: Json; updated_at?: string;
        };
        Relationships: Rel[];
      };
      ferie_state: {
        Row: { data: Json; household_id: string; updated_at: string; updated_by: string | null; version: number };
        Insert: { data?: Json; household_id: string; updated_at?: string; updated_by?: string | null; version?: number };
        Update: { data?: Json; household_id?: string; updated_at?: string; updated_by?: string | null; version?: number };
        Relationships: Rel[];
      };
      household_members: {
        Row: { created_at: string; household_id: string; is_owner: boolean; person: string | null; user_id: string };
        Insert: { created_at?: string; household_id: string; is_owner?: boolean; person?: string | null; user_id: string };
        Update: { created_at?: string; household_id?: string; is_owner?: boolean; person?: string | null; user_id?: string };
        Relationships: Rel[];
      };
      households: {
        Row: { created_at: string; id: string; name: string };
        Insert: { created_at?: string; id?: string; name?: string };
        Update: { created_at?: string; id?: string; name?: string };
        Relationships: [];
      };
      sp_dinner_ideas: {
        Row: {
          created_at: string; created_by: string | null; household_id: string; id: string; image_path: string | null;
          note: string | null; promoted_recipe_id: string | null; tags: string[]; title: string; updated_at: string;
        };
        Insert: {
          created_at?: string; created_by?: string | null; household_id: string; id?: string; image_path?: string | null;
          note?: string | null; promoted_recipe_id?: string | null; tags?: string[]; title: string; updated_at?: string;
        };
        Update: {
          created_at?: string; created_by?: string | null; household_id?: string; id?: string; image_path?: string | null;
          note?: string | null; promoted_recipe_id?: string | null; tags?: string[]; title?: string; updated_at?: string;
        };
        Relationships: Rel[];
      };
      sp_grocery_categories: {
        Row: { created_at: string; created_by: string | null; household_id: string; id: string; name: string; position: number; updated_at: string };
        Insert: { created_at?: string; created_by?: string | null; household_id: string; id?: string; name: string; position?: number; updated_at?: string };
        Update: { created_at?: string; created_by?: string | null; household_id?: string; id?: string; name?: string; position?: number; updated_at?: string };
        Relationships: Rel[];
      };
      sp_meal_plan_entries: {
        Row: {
          calendar_event_id: string | null; calendar_synced_at: string | null; created_at: string; created_by: string | null;
          date: string; free_text: string | null; household_id: string; id: string; idea_id: string | null;
          recipe_id: string | null; servings: number | null; updated_at: string;
        };
        Insert: {
          calendar_event_id?: string | null; calendar_synced_at?: string | null; created_at?: string; created_by?: string | null;
          date: string; free_text?: string | null; household_id: string; id?: string; idea_id?: string | null;
          recipe_id?: string | null; servings?: number | null; updated_at?: string;
        };
        Update: {
          calendar_event_id?: string | null; calendar_synced_at?: string | null; created_at?: string; created_by?: string | null;
          date?: string; free_text?: string | null; household_id?: string; id?: string; idea_id?: string | null;
          recipe_id?: string | null; servings?: number | null; updated_at?: string;
        };
        Relationships: Rel[];
      };
      sp_profiles: {
        Row: { created_at: string; created_by: string | null; dislikes: string[]; household_id: string; id: string; person: string; preferences: string | null; updated_at: string };
        Insert: { created_at?: string; created_by?: string | null; dislikes?: string[]; household_id: string; id?: string; person: string; preferences?: string | null; updated_at?: string };
        Update: { created_at?: string; created_by?: string | null; dislikes?: string[]; household_id?: string; id?: string; person?: string; preferences?: string | null; updated_at?: string };
        Relationships: Rel[];
      };
      sp_recipe_categories: {
        Row: { created_at: string; created_by: string | null; household_id: string; id: string; name: string; position: number; updated_at: string };
        Insert: { created_at?: string; created_by?: string | null; household_id: string; id?: string; name: string; position?: number; updated_at?: string };
        Update: { created_at?: string; created_by?: string | null; household_id?: string; id?: string; name?: string; position?: number; updated_at?: string };
        Relationships: Rel[];
      };
      sp_recipe_ingredients: {
        Row: {
          amount: number | null; canonical_name: string | null; created_at: string; created_by: string | null;
          food_ref: string | null; grocery_category_id: string | null; household_id: string; id: string; name: string;
          note: string | null; position: number; recipe_id: string; scales: boolean; unit: string | null; updated_at: string;
        };
        Insert: {
          amount?: number | null; canonical_name?: string | null; created_at?: string; created_by?: string | null;
          food_ref?: string | null; grocery_category_id?: string | null; household_id: string; id?: string; name: string;
          note?: string | null; position?: number; recipe_id: string; scales?: boolean; unit?: string | null; updated_at?: string;
        };
        Update: {
          amount?: number | null; canonical_name?: string | null; created_at?: string; created_by?: string | null;
          food_ref?: string | null; grocery_category_id?: string | null; household_id?: string; id?: string; name?: string;
          note?: string | null; position?: number; recipe_id?: string; scales?: boolean; unit?: string | null; updated_at?: string;
        };
        Relationships: Rel[];
      };
      sp_recipes: {
        Row: {
          archived_at: string | null; base_servings: number; category_id: string | null; created_at: string;
          created_by: string | null; descriptor: string | null; household_id: string; id: string; image_fetch_attempted_at: string | null; image_path: string | null;
          image_source_url: string | null; nutrition: Json | null; original_text: string | null; source_url: string | null; steps: Json; tags: string[];
          thumb_path: string | null; title: string; total_minutes: number | null; updated_at: string;
        };
        Insert: {
          archived_at?: string | null; base_servings?: number; category_id?: string | null; created_at?: string;
          created_by?: string | null; descriptor?: string | null; household_id: string; id?: string; image_fetch_attempted_at?: string | null; image_path?: string | null;
          image_source_url?: string | null; nutrition?: Json | null; original_text?: string | null; source_url?: string | null; steps?: Json; tags?: string[];
          thumb_path?: string | null; title: string; total_minutes?: number | null; updated_at?: string;
        };
        Update: {
          archived_at?: string | null; base_servings?: number; category_id?: string | null; created_at?: string;
          created_by?: string | null; descriptor?: string | null; household_id?: string; id?: string; image_fetch_attempted_at?: string | null; image_path?: string | null;
          image_source_url?: string | null; nutrition?: Json | null; original_text?: string | null; source_url?: string | null; steps?: Json; tags?: string[];
          thumb_path?: string | null; title?: string; total_minutes?: number | null; updated_at?: string;
        };
        Relationships: Rel[];
      };
      sp_shopping_items: {
        Row: {
          amount: number | null; canonical_name: string | null; checked_at: string | null; checked_by: string | null;
          client_updated_at: string | null; created_at: string; created_by: string | null; grocery_category_id: string | null;
          household_id: string; id: string; name: string; plan_entry_id: string | null; recipe_id: string | null;
          source: string; status: string; unit: string | null; updated_at: string;
        };
        Insert: {
          amount?: number | null; canonical_name?: string | null; checked_at?: string | null; checked_by?: string | null;
          client_updated_at?: string | null; created_at?: string; created_by?: string | null; grocery_category_id?: string | null;
          household_id: string; id?: string; name: string; plan_entry_id?: string | null; recipe_id?: string | null;
          source?: string; status?: string; unit?: string | null; updated_at?: string;
        };
        Update: {
          amount?: number | null; canonical_name?: string | null; checked_at?: string | null; checked_by?: string | null;
          client_updated_at?: string | null; created_at?: string; created_by?: string | null; grocery_category_id?: string | null;
          household_id?: string; id?: string; name?: string; plan_entry_id?: string | null; recipe_id?: string | null;
          source?: string; status?: string; unit?: string | null; updated_at?: string;
        };
        Relationships: Rel[];
      };
      sp_todos: {
        Row: {
          completed_at: string | null; completed_by: string | null; created_at: string; created_by: string | null;
          due_date: string | null; household_id: string; id: string; note: string | null; owner: string; title: string; updated_at: string;
        };
        Insert: {
          completed_at?: string | null; completed_by?: string | null; created_at?: string; created_by?: string | null;
          due_date?: string | null; household_id: string; id?: string; note?: string | null; owner?: string; title: string; updated_at?: string;
        };
        Update: {
          completed_at?: string | null; completed_by?: string | null; created_at?: string; created_by?: string | null;
          due_date?: string | null; household_id?: string; id?: string; note?: string | null; owner?: string; title?: string; updated_at?: string;
        };
        Relationships: Rel[];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Row, insert and update types of a public table: `Tables<'sp_recipes'>`, `TablesInsert<'sp_recipes'>`. */
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
