"use client";

import { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { attachInstruction, extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { createRoot } from "react-dom/client";
// icons
import {
  MoreVertical,
  PenSquare,
  LinkIcon,
  Star,
  FileText,
  Settings,
  Share2,
  LogOut,
  ChevronDown,
  MoreHorizontal,
  Inbox,
} from "lucide-react";
// headless ui
import { Disclosure, Transition } from "@headlessui/react";
// ui
import {
  CustomMenu,
  Tooltip,
  ArchiveIcon,
  PhotoFilterIcon,
  DiceIcon,
  ContrastIcon,
  LayersIcon,
  setPromiseToast,
  DropIndicator,
} from "@plane/ui";
// components
import { Logo } from "@/components/common";
import { LeaveProjectModal, PublishProjectModal } from "@/components/project";
// constants
import { EUserProjectRoles } from "@/constants/project";
// helpers
import { cn } from "@/helpers/common.helper";
// hooks
import { useAppTheme, useEventTracker, useProject } from "@/hooks/store";
import useOutsideClickDetector from "@/hooks/use-outside-click-detector";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { HIGHLIGHT_CLASS, highlightIssueOnDrop } from "../issues/issue-layouts/utils";
// helpers

// components

type Props = {
  projectId: string;
  handleCopyText: () => void;
  handleOnProjectDrop?: (
    sourceId: string | undefined,
    destinationId: string | undefined,
    shouldDropAtEnd: boolean
  ) => void;
  projectListType: "JOINED" | "FAVORITES";
  disableDrag?: boolean;
  disableDrop?: boolean;
  isLastChild: boolean;
};

const navigation = (workspaceSlug: string, projectId: string) => [
  {
    name: "Issues",
    href: `/${workspaceSlug}/projects/${projectId}/issues`,
    Icon: LayersIcon,
  },
  {
    name: "Cycles",
    href: `/${workspaceSlug}/projects/${projectId}/cycles`,
    Icon: ContrastIcon,
  },
  {
    name: "Modules",
    href: `/${workspaceSlug}/projects/${projectId}/modules`,
    Icon: DiceIcon,
  },
  {
    name: "Views",
    href: `/${workspaceSlug}/projects/${projectId}/views`,
    Icon: PhotoFilterIcon,
  },
  {
    name: "Pages",
    href: `/${workspaceSlug}/projects/${projectId}/pages`,
    Icon: FileText,
  },
  {
    name: "Inbox",
    href: `/${workspaceSlug}/projects/${projectId}/inbox`,
    Icon: Inbox,
  },
  {
    name: "Settings",
    href: `/${workspaceSlug}/projects/${projectId}/settings`,
    Icon: Settings,
  },
];

export const ProjectSidebarListItem: React.FC<Props> = observer((props) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { projectId, handleCopyText, disableDrag, disableDrop, isLastChild, handleOnProjectDrop, projectListType } =
    props;
  // store hooks
  const { sidebarCollapsed: isSideBarCollapsed, toggleSidebar } = useAppTheme();
  const { setTrackElement } = useEventTracker();
  const { addProjectToFavorites, removeProjectFromFavorites, getProjectById } = useProject();
  const { isMobile } = usePlatformOS();
  // states
  const [leaveProjectModalOpen, setLeaveProjectModal] = useState(false);
  const [publishModalOpen, setPublishModal] = useState(false);
  const [isMenuActive, setIsMenuActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [instruction, setInstruction] = useState<"DRAG_OVER" | "DRAG_BELOW" | undefined>(undefined);
  // refs
  const actionSectionRef = useRef<HTMLDivElement | null>(null);
  const projectRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement | null>(null);
  // router params
  const { workspaceSlug, projectId: URLProjectId } = useParams();
  // pathname
  const pathname = usePathname();
  // derived values
  const project = getProjectById(projectId);
  // auth
  const isAdmin = project?.member_role === EUserProjectRoles.ADMIN;
  const isViewerOrGuest =
    project?.member_role && [EUserProjectRoles.VIEWER, EUserProjectRoles.GUEST].includes(project.member_role);

  const handleAddToFavorites = () => {
    if (!workspaceSlug || !project) return;

    const addToFavoritePromise = addProjectToFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(addToFavoritePromise, {
      loading: "Adding project to favorites...",
      success: {
        title: "Success!",
        message: () => "Project added to favorites.",
      },
      error: {
        title: "Error!",
        message: () => "Couldn't add the project to favorites. Please try again.",
      },
    });
  };

  const handleRemoveFromFavorites = () => {
    if (!workspaceSlug || !project) return;

    const removeFromFavoritePromise = removeProjectFromFavorites(workspaceSlug.toString(), project.id);
    setPromiseToast(removeFromFavoritePromise, {
      loading: "Removing project from favorites...",
      success: {
        title: "Success!",
        message: () => "Project removed from favorites.",
      },
      error: {
        title: "Error!",
        message: () => "Couldn't remove the project from favorites. Please try again.",
      },
    });
  };

  const handleLeaveProject = () => {
    setTrackElement("APP_SIDEBAR_PROJECT_DROPDOWN");
    setLeaveProjectModal(true);
  };

  const handleLeaveProjectModalClose = () => {
    setLeaveProjectModal(false);
  };

  const handleProjectClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  useEffect(() => {
    const element = projectRef.current;
    const dragHandleElement = dragHandleRef.current;

    if (!element) return;

    return combine(
      draggable({
        element,
        canDrag: () => !disableDrag && !isSideBarCollapsed,
        dragHandle: dragHandleElement ?? undefined,
        getInitialData: () => ({ id: projectId, dragInstanceId: "PROJECTS" }),
        onDragStart: () => {
          setIsDragging(true);
        },
        onDrop: () => {
          setIsDragging(false);
        },
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          // Add a custom drag image
          setCustomNativeDragPreview({
            getOffset: pointerOutsideOfPreview({ x: "0px", y: "0px" }),
            render: ({ container }) => {
              const root = createRoot(container);
              root.render(
                <div className="rounded flex items-center bg-custom-background-100 text-sm p-1 pr-2">
                  <div className="size-4 grid place-items-center flex-shrink-0">
                    {project && <Logo logo={project?.logo_props} />}
                  </div>
                  <p className="truncate text-custom-sidebar-text-200">{project?.name}</p>
                </div>
              );
              return () => root.unmount();
            },
            nativeSetDragImage,
          });
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          !disableDrop && source?.data?.id !== projectId && source?.data?.dragInstanceId === "PROJECTS",
        getData: ({ input, element }) => {
          const data = { id: projectId };

          // attach instruction for last in list
          return attachInstruction(data, {
            input,
            element,
            currentLevel: 0,
            indentPerLevel: 0,
            mode: isLastChild ? "last-in-group" : "standard",
          });
        },
        onDrag: ({ self }) => {
          const extractedInstruction = extractInstruction(self?.data)?.type;
          // check if the highlight is to be shown above or below
          setInstruction(
            extractedInstruction
              ? extractedInstruction === "reorder-below" && isLastChild
                ? "DRAG_BELOW"
                : "DRAG_OVER"
              : undefined
          );
        },
        onDragLeave: () => {
          setInstruction(undefined);
        },
        onDrop: ({ self, source }) => {
          setInstruction(undefined);
          const extractedInstruction = extractInstruction(self?.data)?.type;
          const currentInstruction = extractedInstruction
            ? extractedInstruction === "reorder-below" && isLastChild
              ? "DRAG_BELOW"
              : "DRAG_OVER"
            : undefined;
          if (!currentInstruction) return;

          const sourceId = source?.data?.id as string | undefined;
          const destinationId = self?.data?.id as string | undefined;

          handleOnProjectDrop && handleOnProjectDrop(sourceId, destinationId, currentInstruction === "DRAG_BELOW");

          highlightIssueOnDrop(`sidebar-${sourceId}-${projectListType}`);
        },
      })
    );
  }, [projectRef?.current, dragHandleRef?.current, projectId, isLastChild, projectListType, handleOnProjectDrop]);

  useOutsideClickDetector(actionSectionRef, () => setIsMenuActive(false));
  useOutsideClickDetector(projectRef, () => projectRef?.current?.classList?.remove(HIGHLIGHT_CLASS));

  if (!project) return null;

  return (
    <>
      <PublishProjectModal isOpen={publishModalOpen} project={project} onClose={() => setPublishModal(false)} />
      <LeaveProjectModal project={project} isOpen={leaveProjectModalOpen} onClose={handleLeaveProjectModalClose} />
      <Disclosure key={`${project.id}_${URLProjectId}`} ref={projectRef} defaultOpen={URLProjectId === project.id}>
        {({ open }) => (
          <div
            id={`sidebar-${projectId}-${projectListType}`}
            className={cn("rounded relative", { "bg-custom-sidebar-background-80 opacity-60": isDragging })}
          >
            <DropIndicator classNames="absolute top-0" isVisible={instruction === "DRAG_OVER"} />
            <div
              className={cn(
                "h-9 group relative flex w-full px-3 py-2 items-center rounded-md text-custom-sidebar-text-100 hover:bg-custom-sidebar-background-80",
                {
                  "bg-custom-sidebar-background-80": isMenuActive,
                  "pr-0": !isSideBarCollapsed,
                }
              )}
            >
              {!disableDrag && (
                <Tooltip
                  isMobile={isMobile}
                  tooltipContent={project.sort_order === null ? "Join the project to rearrange" : "Drag to rearrange"}
                  position="top-right"
                  disabled={isDragging}
                >
                  <button
                    type="button"
                    className={cn(
                      "absolute -left-[18px] flex opacity-0 rounded text-custom-sidebar-text-400 ml-2 cursor-grab",
                      {
                        "group-hover:opacity-100": !isSideBarCollapsed,
                        "cursor-not-allowed opacity-60": project.sort_order === null,
                        "cursor-grabbing": isDragging,
                        flex: isMenuActive,
                        hidden: isSideBarCollapsed,
                      }
                    )}
                    ref={dragHandleRef}
                  >
                    <MoreVertical className="-ml-3 h-3.5" />
                    <MoreVertical className="-ml-5 h-3.5" />
                  </button>
                </Tooltip>
              )}
              <Tooltip
                tooltipContent={`${project.name}`}
                position="right"
                disabled={!isSideBarCollapsed}
                isMobile={isMobile}
              >
                <Disclosure.Button
                  as="div"
                  className={cn(
                    "flex flex-grow cursor-pointer select-none items-center justify-between truncate text-left text-sm font-medium",
                    {
                      "justify-center": isSideBarCollapsed,
                    }
                  )}
                >
                  <div
                    className={cn("flex w-full flex-grow items-center gap-2.5 truncate", {
                      "justify-center": isSideBarCollapsed,
                    })}
                  >
                    <div className="size-5 grid place-items-center flex-shrink-0">
                      <Logo logo={project.logo_props} />
                    </div>
                    {!isSideBarCollapsed && <p className="truncate text-custom-sidebar-text-200">{project.name}</p>}
                  </div>
                  {!isSideBarCollapsed && (
                    <ChevronDown
                      className={cn(
                        "hidden h-4 w-4 flex-shrink-0 text-custom-sidebar-text-400 duration-300 group-hover:block",
                        {
                          "rotate-180": open,
                          block: isMenuActive,
                        }
                      )}
                    />
                  )}
                </Disclosure.Button>
              </Tooltip>

              {!isSideBarCollapsed && (
                <CustomMenu
                  customButton={
                    <div
                      ref={actionSectionRef}
                      className="size-5 flex items-center justify-center cursor-pointer px-1 text-custom-sidebar-text-400 duration-300"
                      onClick={() => setIsMenuActive(!isMenuActive)}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </div>
                  }
                  className={cn("hidden flex-shrink-0 mr-1 group-hover:block", {
                    "!block": isMenuActive,
                  })}
                  buttonClassName="!text-custom-sidebar-text-400"
                  placement="bottom-start"
                >
                  {!project.is_favorite && (
                    <CustomMenu.MenuItem onClick={handleAddToFavorites}>
                      <span className="flex items-center justify-start gap-2">
                        <Star className="h-3.5 w-3.5 stroke-[1.5]" />
                        <span>Add to favorites</span>
                      </span>
                    </CustomMenu.MenuItem>
                  )}
                  {project.is_favorite && (
                    <CustomMenu.MenuItem onClick={handleRemoveFromFavorites}>
                      <span className="flex items-center justify-start gap-2">
                        <Star className="h-3.5 w-3.5 fill-yellow-500 stroke-yellow-500" />
                        <span>Remove from favorites</span>
                      </span>
                    </CustomMenu.MenuItem>
                  )}
                  {/* publish project settings */}
                  {isAdmin && (
                    <CustomMenu.MenuItem onClick={() => setPublishModal(true)}>
                      <div className="relative flex flex-shrink-0 items-center justify-start gap-2">
                        <div className="flex h-4 w-4 cursor-pointer items-center justify-center rounded text-custom-sidebar-text-200 transition-all duration-300 hover:bg-custom-sidebar-background-80">
                          <Share2 className="h-3.5 w-3.5 stroke-[1.5]" />
                        </div>
                        <div>{project.anchor ? "Publish settings" : "Publish"}</div>
                      </div>
                    </CustomMenu.MenuItem>
                  )}
                  <CustomMenu.MenuItem>
                    <Link href={`/${workspaceSlug}/projects/${project?.id}/draft-issues/`}>
                      <div className="flex items-center justify-start gap-2">
                        <PenSquare className="h-3.5 w-3.5 stroke-[1.5] text-custom-text-300" />
                        <span>Draft issues</span>
                      </div>
                    </Link>
                  </CustomMenu.MenuItem>
                  <CustomMenu.MenuItem onClick={handleCopyText}>
                    <span className="flex items-center justify-start gap-2">
                      <LinkIcon className="h-3.5 w-3.5 stroke-[1.5]" />
                      <span>Copy link</span>
                    </span>
                  </CustomMenu.MenuItem>

                  {!isViewerOrGuest && (
                    <CustomMenu.MenuItem>
                      <Link href={`/${workspaceSlug}/projects/${project?.id}/archives/issues`}>
                        <div className="flex items-center justify-start gap-2">
                          <ArchiveIcon className="h-3.5 w-3.5 stroke-[1.5]" />
                          <span>Archives</span>
                        </div>
                      </Link>
                    </CustomMenu.MenuItem>
                  )}
                  <CustomMenu.MenuItem>
                    <Link href={`/${workspaceSlug}/projects/${project?.id}/settings`}>
                      <div className="flex items-center justify-start gap-2">
                        <Settings className="h-3.5 w-3.5 stroke-[1.5]" />
                        <span>Settings</span>
                      </div>
                    </Link>
                  </CustomMenu.MenuItem>
                  {/* leave project */}
                  {isViewerOrGuest && (
                    <CustomMenu.MenuItem onClick={handleLeaveProject}>
                      <div className="flex items-center justify-start gap-2">
                        <LogOut className="h-3.5 w-3.5 stroke-[1.5]" />
                        <span>Leave project</span>
                      </div>
                    </CustomMenu.MenuItem>
                  )}
                </CustomMenu>
              )}
            </div>

            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <Disclosure.Panel className={`mt-1 space-y-1 ${isSideBarCollapsed ? "" : "ml-[1.25rem]"}`}>
                {navigation(workspaceSlug as string, project?.id).map((item) => {
                  if (
                    (item.name === "Cycles" && !project.cycle_view) ||
                    (item.name === "Modules" && !project.module_view) ||
                    (item.name === "Views" && !project.issue_views_view) ||
                    (item.name === "Pages" && !project.page_view) ||
                    (item.name === "Inbox" && !project.inbox_view)
                  )
                    return;

                  return (
                    <Link key={item.name} href={item.href} onClick={handleProjectClick}>
                      <span className="block w-full">
                        <Tooltip
                          isMobile={isMobile}
                          tooltipContent={`${project?.name}: ${item.name}`}
                          position="right"
                          className="ml-2"
                          disabled={!isSideBarCollapsed}
                        >
                          <div
                            className={`group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium outline-none ${
                              pathname.includes(item.href)
                                ? "bg-custom-primary-100/10 text-custom-primary-100"
                                : "text-custom-sidebar-text-300 hover:bg-custom-sidebar-background-80 focus:bg-custom-sidebar-background-80"
                            } ${isSideBarCollapsed ? "justify-center" : ""}`}
                          >
                            <item.Icon className="h-4 w-4 stroke-[1.5]" />
                            {!isSideBarCollapsed && item.name}
                          </div>
                        </Tooltip>
                      </span>
                    </Link>
                  );
                })}
              </Disclosure.Panel>
            </Transition>
            {isLastChild && <DropIndicator isVisible={instruction === "DRAG_BELOW"} />}
          </div>
        )}
      </Disclosure>
    </>
  );
});