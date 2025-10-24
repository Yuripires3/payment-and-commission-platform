from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class Partner(Base):
    __tablename__ = "partners"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    
    cnpj = Column(String(14), unique=True, nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=True)
    
    # Banking info
    bank_code = Column(String(10), nullable=True)
    bank_name = Column(String(100), nullable=True)
    agency = Column(String(20), nullable=True)
    account = Column(String(20), nullable=True)
    account_type = Column(String(20), nullable=True)
    pix_key = Column(String(255), nullable=True)
    pix_key_type = Column(String(20), nullable=True)
    
    # Address
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(2), nullable=True)
    zip_code = Column(String(8), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    onboarding_completed = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="partner")
    commissions = relationship("Commission", back_populates="partner")
    invoices = relationship("Invoice", back_populates="partner")
