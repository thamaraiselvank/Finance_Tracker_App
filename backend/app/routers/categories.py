from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.core.database import fetch_all, fetch_one, execute_returning, execute_query
from app.core.security import get_current_user_id
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate, SubcategoryCreate, SubcategoryOut

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryOut])
def get_categories(type: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """Returns all system categories plus user's custom categories with their subcategories."""
    query = """
        SELECT c.* 
        FROM categories c
        WHERE (c.user_id = %s OR c.is_system = TRUE)
    """
    params = [user_id]
    if type:
        query += " AND c.type = %s"
        params.append(type.upper())
        
    query += " ORDER BY c.is_system DESC, c.name ASC"
    categories = fetch_all(query, tuple(params))
    
    if not categories:
        return []
        
    # Fetch all subcategories for these categories
    cat_ids = [c["id"] for c in categories]
    placeholders = ', '.join(['%s'] * len(cat_ids))
    subcats = fetch_all(f"""
        SELECT * FROM subcategories 
        WHERE category_id IN ({placeholders})
        ORDER BY name ASC
    """, tuple(cat_ids))
    
    subcat_map = {}
    seen_subcategories = set()
    for sc in subcats:
        c_id = str(sc["category_id"])
        dedupe_key = (c_id, sc["name"].strip().casefold())
        if dedupe_key in seen_subcategories:
            continue
        seen_subcategories.add(dedupe_key)
        if c_id not in subcat_map:
            subcat_map[c_id] = []
        subcat_map[c_id].append(sc)
        
    result = []
    for c in categories:
        c_id_str = str(c["id"])
        c["subcategories"] = subcat_map.get(c_id_str, [])
        result.append(c)
        
    return result

@router.post("", response_model=CategoryOut)
def create_category(payload: CategoryCreate, user_id: str = Depends(get_current_user_id)):
    new_cat = execute_returning("""
        INSERT INTO categories (user_id, name, type, icon, color, is_system)
        VALUES (%s, %s, %s, %s, %s, FALSE)
        RETURNING *
    """, (user_id, payload.name, payload.type.upper(), payload.icon or 'Tag', payload.color or '#10B981'))
    
    cat_id = new_cat["id"]
    subcategories = []
    if payload.subcategories:
        for sub_name in payload.subcategories:
            if sub_name.strip():
                new_sub = execute_returning("""
                    INSERT INTO subcategories (category_id, name)
                    VALUES (%s, %s)
                    RETURNING *
                """, (cat_id, sub_name.strip()))
                if new_sub:
                    subcategories.append(new_sub)
                    
    new_cat["subcategories"] = subcategories
    return new_cat

@router.post("/{category_id}/subcategories", response_model=SubcategoryOut)
def add_subcategory(category_id: str, payload: SubcategoryCreate, user_id: str = Depends(get_current_user_id)):
    # Check category ownership or allow adding custom subcategory
    cat = fetch_one("SELECT * FROM categories WHERE id = %s AND (user_id = %s OR is_system = TRUE)", (category_id, user_id))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
        
    new_sub = execute_returning("""
        INSERT INTO subcategories (category_id, name)
        VALUES (%s, %s)
        RETURNING *
    """, (category_id, payload.name.strip()))
    return new_sub

@router.delete("/{category_id}")
def delete_category(category_id: str, user_id: str = Depends(get_current_user_id)):
    cat = fetch_one("SELECT * FROM categories WHERE id = %s AND user_id = %s", (category_id, user_id))
    if not cat:
        raise HTTPException(status_code=404, detail="Custom category not found or is a protected system category.")
        
    execute_query("DELETE FROM categories WHERE id = %s AND user_id = %s", (category_id, user_id))
    return {"message": "Category deleted successfully."}
