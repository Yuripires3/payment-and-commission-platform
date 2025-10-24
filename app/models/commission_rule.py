from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base
from app.models.product import CommissionType


class CommissionRule(Base):
    __tablename__ = "commission_rules"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    version = Column(String(20), nullable=False, default="1.0")
    
    commission_type = Column(SQLEnum(CommissionType), nullable=False)
    
    # For fixed commission
    fixed_amount = Column(Numeric(10, 2), nullable=True)
    
    # For percentage commission
    percentage = Column(Numeric(5, 2), nullable=True)
    
    # Advanced rules (JSON)
    # Can include: ranges, bonuses, cashback, channel-specific, state-specific, etc.
    advanced_rules = Column(JSON, nullable=True)
    
    # Validity
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=True)
    
    is_active = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=False)
    approved_by = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    product = relationship("Product", back_populates="commission_rules")
