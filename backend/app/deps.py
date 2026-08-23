"""
Shared app-lifetime resources (master data indexes, DB engine, LLM
provider) built once at startup and exposed to routers via FastAPI
dependency injection, per knowledge-base/APPLICATION_ARCHITECTURE.md §5
("Loads master data... at startup").
"""

from dataclasses import dataclass

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.llm.base import BaseLLMProvider
from app.llm.factory import build_llm_provider
from app.master_data.loader import load_lov, load_manufacturer_brand, load_uom
from app.master_data.lov_index import LovIndex
from app.master_data.manufacturer_index import ManufacturerIndex
from app.master_data.uom_index import UomIndex
from app.db.session import create_engine_from_settings, init_db


@dataclass
class AppResources:
    settings: Settings
    provider: BaseLLMProvider
    lov_index: LovIndex
    manufacturer_index: ManufacturerIndex
    uom_index: UomIndex
    db_engine: AsyncEngine


async def build_app_resources(settings: Settings) -> AppResources:
    provider = build_llm_provider(settings)
    lov_index = LovIndex(load_lov(settings.master_data_dir))
    manufacturer_index = ManufacturerIndex(load_manufacturer_brand(settings.master_data_dir))
    uom_index = UomIndex(load_uom(settings.master_data_dir))
    db_engine = create_engine_from_settings(settings)
    await init_db(db_engine)

    return AppResources(
        settings=settings,
        provider=provider,
        lov_index=lov_index,
        manufacturer_index=manufacturer_index,
        uom_index=uom_index,
        db_engine=db_engine,
    )


def get_app_resources(request: Request) -> AppResources:
    return request.app.state.resources
