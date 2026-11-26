"""
Profiles Router: Manage multi-user profiles for LAN viewing.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Profile, WatchHistory, Watchlist
from backend.schemas import ProfileCreate, ProfileUpdate, ProfileOut

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


def get_current_profile(
    x_profile_id: int | None = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db),
) -> Profile | None:
    """Helper dependency to resolve the active profile from X-Profile-ID header."""
    if x_profile_id:
        return db.query(Profile).filter(Profile.id == x_profile_id).first()
    # Default to first admin profile
    return db.query(Profile).filter(Profile.is_admin == True).order_by(Profile.id.asc()).first()


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    """List all profiles."""
    profiles = db.query(Profile).order_by(Profile.is_admin.desc(), Profile.id.asc()).all()
    if not profiles:
        # Guarantee at least one admin profile exists
        admin = Profile(name="Admin", avatar="netflix-red", is_admin=True)
        db.add(admin)
        db.commit()
        db.refresh(admin)
        return [admin]
    return profiles


@router.get("/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    """Get single profile by ID."""
    p = db.query(Profile).filter(Profile.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    return p


@router.post("", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    body: ProfileCreate,
    current_profile: Profile | None = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    """
    Create a new profile.
    Only existing admins can create an admin profile.
    """
    # Prevent unauthorized elevation to admin
    is_admin = False
    if body.is_admin and current_profile and current_profile.is_admin:
        is_admin = True

    new_p = Profile(
        name=body.name.strip() or "Viewer",
        avatar=body.avatar or "netflix-blue",
        is_admin=is_admin,
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p


@router.put("/{profile_id}", response_model=ProfileOut)
def update_profile(
    profile_id: int,
    body: ProfileUpdate,
    db: Session = Depends(get_db),
):
    """Update profile name or avatar."""
    p = db.query(Profile).filter(Profile.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")

    if body.name is not None and body.name.strip():
        p.name = body.name.strip()
    if body.avatar is not None and body.avatar.strip():
        p.avatar = body.avatar.strip()

    db.commit()
    db.refresh(p)
    return p


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile_id: int,
    current_profile: Profile | None = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    """
    Delete a profile.
    Admin profiles cannot be deleted.
    Only an admin can delete profiles.
    """
    if not current_profile or not current_profile.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin can delete profiles",
        )

    p = db.query(Profile).filter(Profile.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")

    if p.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primary Admin profile cannot be deleted",
        )

    # Clean up associated watch history & watchlist
    db.query(WatchHistory).filter(WatchHistory.profile_id == profile_id).delete()
    db.query(Watchlist).filter(Watchlist.profile_id == profile_id).delete()
    db.delete(p)
    db.commit()
    return None
