"use client";

import { analysesPerMonth } from "@/app/api/datasets/columns";
import { Backdrop, CircularProgress, Grid, GridGridItem, ProgressLinear } from "@/components/ui/progress";
import type { Dataset } from "@/interfaces/dataset";
import { useClevrWordmarkDark } from "@/lib/urls/clevr";
import { useEffect, useRef } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import type { Metadata } from "@/types/metadata";
import Link from "next/link";
import useRouter from "next/navigation";
import { Alert } from "@library/components";
import BusinessInsightDashboard from "@/types/bi";
import BusinessVertical, { parseBusinessVertical } from "@library/business-vertical";

export const BIMenuItems = [
  {
    groupName: {
      label: "Business Intelligence",
      description: "Einstein Assitant Corporate Intelligence",
    },
    items: [
      {
        title: "Dashboard",
        href: "/app/business-intelligence",
        description: "Executive Dashboard",
        icon: "mascotUXIngenious",
        iconItem: "mascotUXIngeniousItem",
      },
      {
        title: "Reports",
        href: "/app/reporting",
        description: "Read-only Bi Reports",
        icon: "mascotUXAnalytic",
        iconItem: "mascotUXAnalyticItem",
      },
      {
        title: "Connections",
        href: "/app/connections",
        description: "Data Integrations",
        icon: "mascotUXIntegration",
        iconItem: "mascotUXIntegrationItem",
      },
      {
        title: "DataLab",
        href: "/app/data-lab",
        description: "Data Science exploration facility",
        icon: "mascotUXDiscovery",
        iconItem: "mascotUXDiscoveryItem",
      },
    ],
  },
];

class BiMenuitem extends React.Component<any, any> {
  state = {
    hover: false,
    hoverMenu: false,
    openCurrente: false,
  };
  handleOpen() {
    this.setState(() => ({
      openCurrente: true,
    }));
  }
  handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    this.setState(() => ({
      openCurrente: false,
    }));
  }
  render() {
    const _ = this.props;
    return (
      <DropdownMenu
        menuExpand={true}
        btnRound="2xl"
        href={this.props.href}
        action={
          this.props.action ||
            ({
              fill: this.state.hover ? "neutral" : "neutral",
              variant: this.props.as === "a" ? "solid" : "outline",
              indicator: false,
            })
        }
        onClick={() => {
          this.state.openCurrente ? this.handleClose(e) : this.handleOpen();
        }}
        open={this.state.openCurrente}
        menuClassName="w-[320px]"
        onScroll={() => void 0}
        onClose={() => void 0}
      >
        {/* ... */}
      </DropdownMenu>
    );
  }
}