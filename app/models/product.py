from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class CommissionType(str, enum.Enum):
    FIXED = "fixed"
    PERCENTAGE = "percentage"
    HYBRID = "hybrid"


class Product(Base):
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    commission_rules = relationship("CommissionRule", back_populates="product")
    commissions = relationship("Commission", back_populates="product")
